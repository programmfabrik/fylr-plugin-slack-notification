# fylr-plugin-slack-notification

This plugin provides slack-notification via a slack-webhook-url. For example CustomDataTypePlugin-Updater can use this custom api endpoint to send messages to a slack-channel in case of errors.

## installation

The latest version of this plugin can be found [here](https://github.com/programmfabrik/fylr-plugin-slack-notification/releases/latest/download/fylr-plugin-slack-notification.zip).

The ZIP can be downloaded and installed using the plugin manager, or used directly (recommended).

Github has an overview page to get a list of [all releases](https://github.com/programmfabrik/fylr-plugin-slack-notification/releases/).

## Konfiguration

- `slack_webhook_url`: a valid slack-webhook-url
- `slack_cooldown_minutes`: int
- `slack_buffer_enabled`: `true` oder `false`

Explanations:

If the buffer is enabled, messages are buffered and send in bulk, when cooldown is over. If cooldown is bigger zero and buffer is disabled, messages are skipped and deleted, till cooldowntime is over.

## API

Other applications can call the endpoint.

Example: 

`/api/v1/plugin/extension/slack-notification/slack_notification?access_token=ory_foobar&source_instance=fylr-example&source_name=myBestPlugin&message=error%20occured%20OMG`

## Implementation

You can integrate the slack-endpoint for example like this

```    
try {
    var slackUrl = instance_name.replace(/\/+$/, '') + "/api/v1/plugin/extension/slack-notification/slack_notification?access_token=" + access_token + "&source_instance=" + instance_name + "&source_name=" + plugin_name + "&message=" + encodeURIComponent(errorMessage);
    await fetch(slackUrl, { signal: AbortSignal.timeout(2000) }).catch(function() {});
} catch (e) {}```
