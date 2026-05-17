let body = $response.body;
if (!body) { $done({}); }

body = body.replace(/"status":"8"/g, '"status":"0"');
body = body.replace(/"status":"7"/g, '"status":"0"');
body = body.replace(/hour_coupon_empty_in_this_time button_no_click/g, 'can_get button_can_click');
body = body.replace(/hour_coupon_not_in_accept_time button_no_click/g, 'can_get button_can_click');
body = body.replace(/"receiveStatus":"-1"/g, '"receiveStatus":"0"');
body = body.replace(/"countDown":[1-9][0-9]{4,}/g, '"countDown":0');

$done({ body: body });