let lgtv = require('lgtv2')({
    url: `ws://192.168.1.105:3000`
});

lgtv.on('connect', () => {
    lgtv.getAppStatus().then(res => console.log(res));
    console.log(`🔌 Connected`);
});

lgtv.on('error', (err) => {
    if (err) console.log(err);
});

lgtv.getAppStatus = function () {
    return new Promise(resolve => {
        lgtv.request(`ssap://com.webos.service.audio/playSound`, (err, res) => {
            if (!err) resolve(res);
            else resolve(false);
        });
    })
}