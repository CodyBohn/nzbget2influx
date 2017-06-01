'use strict';

const Influx = require('influx');
const nzbget = require('node-nzbget');

const checkInterval = process.env.UPDATE_INTERVAL_MS || 1000 * 30;

const influxClient = new Influx.InfluxDB({
    host: process.env.INFLUX_HOST || 'localhost',
    port: process.env.INFLUX_PORT || 8086,
    protocol: process.env.INFLUX_PROTOCOL || 'http',
    database: process.env.INFLUX_DB || 'nzbget'
});

const nzbgetConfig = {
    host: process.env.NZBGET_HOST || 'localhost',
    protocol: process.env.NZBGET_PROTOCOL ||'http',
    port: process.env.NZBGET_PORT || 6789,
    username: process.env.NZBGET_USERNAME || '',
    password: process.env.NZBGET_PASSWORD || ''
};

function writeToInflux(seriesName, values, tags) {
    var payload = {
        fields: values
    };

    if (tags) {
        payload.tags = tags;
    }

    return influxClient.writeMeasurement(seriesName, [payload]);
}

const ng = new nzbget({
    url: `${nzbgetConfig.host}:${nzbgetConfig.port}`,
    username: nzbgetConfig.username,
    password: nzbgetConfig.password
});

function onGetNZBData(data) {
    let nzbs = data.result;

    nzbs.forEach(function(nzb) {
        let value = {
            name: nzb.NZBName,
            size: nzb.FileSizeLo
        };
        let tags = {
            status: nzb.Status,
            category: nzb.Category
        };

        writeToInflux('nzb', value, tags).then(function() {
            console.dir(`wrote ${nzb.NZBName} nzb data to influx: ${new Date()}`);
        });
    });

    writeToInflux('nzbs', {
        count: nzbs.length
    }, null).then(function() {
        console.dir(`wrote ${nzbs.length} nzbs data to influx: ${new Date()}`);
        restart();
    });
}

function restart(err) {
    if (err) {
        console.log(err);
    }

    // Every {checkInterval} seconds
    setTimeout(getAllTheMetrics, checkInterval);
}

function getAllTheMetrics() {
    ng.listgroups().then(onGetNZBData).catch(restart);
}

getAllTheMetrics();
