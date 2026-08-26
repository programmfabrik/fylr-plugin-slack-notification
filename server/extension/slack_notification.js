// GET /api/v1/plugin/extension/slack-notification/slack_notification?access_token=foobar&source_instance=examplefylr&source_name=plugin123

const fs = require('fs');
const https = require('https');
const path = require('path');

let info = {}
if (process.argv.length >= 3) {
    info = JSON.parse(process.argv[2])
}

// throws api-error
function throwError(error, description) {
    console.log(JSON.stringify({
        "error": {
            "code": "error",
            "statuscode": 400,
            "realm": "api",
            "error": error,
            "parameters": {},
            "description": description
        }
    }));
    process.exit(0);
}

// read slack config from pluginconfig
const slack_webhook_url = info.config?.plugin['slack-notification']?.config['slack_notification']?.slack_webhook_url || false;
const slack_cooldown_minutes = info.config?.plugin['slack-notification']?.config['slack_notification']?.slack_cooldown_minutes;
const slack_buffer_enabled = info.config?.plugin['slack-notification']?.config['slack_notification']?.slack_buffer_enabled || false;
let slack_allowed_user_ids = [];
if(info.config?.plugin['slack-notification']?.config['slack_notification']?.slack_allowed_users) {
    let usersInfo = info.config.plugin['slack-notification'].config['slack_notification'].slack_allowed_users;
    slack_allowed_user_ids = usersInfo.map((user) => user.slack_allowed_user.user._id);
}

// check if plugins token is from a valid user
if(! slack_allowed_user_ids.includes(info?.api_user.user._id)) {
    throwError("slack-notification-plugin", "Request from user, which is not allowed");
}

// cancel if no webhook-url is given
if(!slack_webhook_url) {
    throwError("slack-notification-plugin", "No slack_webhook_url configured!");
}

// read source-information-parameters from config
let sourceInstance = info.external_url;
sourceInstance = sourceInstance.replace('https://', '');
sourceInstance = sourceInstance.replace('http://', '');
sourceInstance = sourceInstance.replace('/', '');

// read sourcename (pluginname f.e.)
const sourceName = info.request?.query?.source_name?.[0] || false;

// read message
const message = info.request?.query?.message?.[0] || false;

// cancel if no source-info is given
if(!sourceName) {
    throwError("slack-notification-plugin", "No sourceName in request!");
}

// cancel if no message is given
if(!message) {
    throwError("slack-notification-plugin", "No message transmitted!");
}

// TODO 
// noch sowas einbauen, dass auch im erfolgsfall geschaut wird, ob der buffer geleert wird. aber 
// nicht immer, sondern nur manchmal. hier oder im GND? Oder dann weglassen, weil es nur mit gnd sinn gibt..?

let input = '';
process.stdin.on('data', d => {
    try {
        input += d.toString();
    } catch (e) {
        console.error(`Could not read input into string: ${e.message}`, e.stack);
        process.exit(1);
    }
});

process.stdin.on('end', async() => {

    //////////////////////////////////////////////////////////////
    // Accesstoken
    let access_token = info.api_user_access_token;    

    const statusMessage = await sendSlackAlert(
        {
            message: message, 
            webhookUrl: slack_webhook_url, 
            sourceInstance: sourceInstance, 
            sourceName: sourceName, 
            bufferEnabled: slack_buffer_enabled, 
            cooldownMinutes: slack_cooldown_minutes
        }
    );

    let result = {
        "result": statusMessage
    };

    console.log(JSON.stringify(result, null, 2));   
    process.exit(0); 
});