const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const handlebars = require('express-handlebars');

const { Logger } = require('euberlog');
const logger = new Logger();

const { PORT } = require('./config');

const app = express();

// DATA

let data = {};

function getEmptyMachineData() {
    return {
        localIp: null,
        publicIp: null,
        ngrokUrl: null,
        date: null
    };
}

function handleCheckErrorString(str, name) {
    let message = null;

    if (typeof str !== 'string' || !str) {
        message = `${name} must be a non-empty string`;
        logger.error(message);
    }

    return message;
}

function getHostnameAndPort(url) {
    let result = { hostname: null, port: null };

    if (url) {
        const regexp = /^tcp:\/\/(?<hostname>[\w\.]+):(?<port>\d+)$/;
        const match = url.match(regexp);
        result = match?.groups ?? result;
    }

    return result;
}

// MIDDLEWARES

logger.hr();

logger.info('Load middlewares...');

logger.debug('Use cors middleware');
app.use(cors());
logger.debug('Use compression middleware');
app.use(compression());
logger.debug('Use helmet middleware');
app.use(helmet());
logger.debug('Use morgan middleware');
app.use(morgan('dev'));
logger.debug('Use body-parser middleware');
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

logger.success('Middlewares loaded');

logger.hr();

// ROUTES

logger.info('Add routes...');

logger.debug('GET /eagletrt/machines');
app.get('/eagletrt/machines', (_req, res) => {
    res.send(Object.keys(data));
});

logger.debug('GET /eagletrt/:machine/info');
app.get('/eagletrt/:machine/info', (req, res) => {
    const { machine } = req.params;

    const errorMessage = handleCheckErrorString(machine, 'machine');
    if (errorMessage) {
        return res.status(400).send(errorMessage);
    }

    let machineData = data[machine];
    if (!machineData) {
        machineData = getEmptyMachineData();
        data[machine] = machineData;
    }

    const { hostname, port } = getHostnameAndPort(machineData.ngrokUrl);
    const ssh = hostname && port ? `ssh ubuntu@${hostname} -p ${port}` : null;
    res.send({ ...machineData, hostname, port, ssh });
});

logger.debug('POST /eagletrt/:machine/info');
app.post('/eagletrt/:machine/info', (req, res) => {
    const { machine } = req.params;

    const errorMessage = handleCheckErrorString(machine, 'machine');
    if (errorMessage) {
        return res.status(400).send(errorMessage);
    }

    const newData = {
        ngrokUrl: req.body.ngrokUrl,
        localIp: req.body.localIp,
        publicIp: req.body.publicIp,
        date: new Date()
    };

    for (const param of Object.keys(newData).filter(k => k !== 'date')) {
        const message = handleCheckErrorString(newData[param], param);
        if (message) {
            return res.status(400).send(message);
        }
    }

    data[machine] = newData;

    return res.send();
});

logger.success('Routes added');

logger.hr();

// FRONTEND

logger.info('Setting forntend');

logger.debug('Set handlebars as view engine');
app.engine('hbs', handlebars({ extname: '.hbs', defaultLayout: null }));
app.set('view engine', 'hbs');

logger.debug('Expose static content');
app.use('/public', express.static(path.join(__dirname, 'public')));

logger.debug('Add main frontend route');
app.get('/', (_req, res) => {
    const machineData = data.telemetria;
    const { hostname, port } = getHostnameAndPort(machineData.ngrokUrl);
    const ssh = hostname && port ? `ssh ubuntu@${hostname} -p ${port}` : null;
    const date = machineData.date ? machineData.date.toLocaleString() : null;
    res.render('home', { ...machineData, date, hostname, port, ssh });
})

// LISTEN

logger.info('Start server...');
app.listen(PORT, () => {
    logger.success('Server listening on port', PORT);
});
