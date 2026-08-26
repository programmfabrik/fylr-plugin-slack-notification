async function sendSlackAlert({
    message,
    webhookUrl,
    sourceInstance,
    sourceName,
    bufferEnabled = true,
    cooldownMinutes = 60
}) {
    return new Promise((resolve) => {
        if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('https://')) {
            console.error('[' + sourceInstance + '] Keine gültige Slack Webhook URL übergeben: ' + webhookUrl);
            return resolve('[' + sourceInstance + '] Keine gültige Slack Webhook URL übergeben: ' + webhookUrl);
        }

        const now = Date.now();
        const currentTimeString = new Date().toISOString().substring(11, 19);
        const sanitizedsourceInstance = sourceInstance.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        const bufferFile = path.join('/tmp', 'slack_buffer_notification_plugin.json');

        let bufferData = { lastAlert: 0, messages: [] };

        if (fs.existsSync(bufferFile)) {
            try {
                bufferData = JSON.parse(fs.readFileSync(bufferFile, 'utf8'));
                if (!Array.isArray(bufferData.messages)) bufferData.messages = [];
            } catch (e) {
                console.error('[' + sourceInstance + '] Fehler beim Lesen der Cooldown-Datei: ' + e.message);
            }
        }

        const cooldownMs = cooldownMinutes * 60 * 1000;
        const timeSinceLastAlert = now - (bufferData.lastAlert || 0);
        const isCooldownActive = cooldownMinutes > 0 && bufferData.lastAlert > 0 && timeSinceLastAlert < cooldownMs;
        let payloadText = '';

        // Buffer deactivated?
        if (!bufferEnabled) {
            // if cooldown active --> no message
            if (isCooldownActive) {
                console.error('[' + sourceInstance + '] Nachricht verworfen (Puffer aus, Cooldown aktiv).');
                return resolve('Message skipped (Cooldown active, buffer disabled)');
            }
            // if no cooldown -> prepare message
            console.error('[' + sourceInstance + '] Puffer deaktiviert. Sende Direkt-Alert...');
            payloadText = '*' + sourceInstance + ' Fehler-Report (Sofortbenachrichtigung):*\n```\n[' + currentTimeString + '] ' + message + '\n```';
        } 
        
        // Buffer activated?
        else {
            if (!bufferData.lastAlert) {
                bufferData.lastAlert = now;
            }

            // create new message for buffer
            if (message) {
                bufferData.messages.push({
                    time: currentTimeString,
                    sourceInstance: sourceInstance,
                    sourceName: sourceName,
                    text: message
                });
            }

            // max 50 messages for buffer
            if (bufferData.messages.length > 50) {
                bufferData.messages = bufferData.messages.slice(-50);
            }

            // if buffer active AND cooldown: add message to buffer and resolve
            if (isCooldownActive) {
                try {
                    fs.writeFileSync(bufferFile, JSON.stringify(bufferData, null, 2));
                    console.error('[' + sourceInstance + ' - ' + sourceName + '] Nachricht gepuffert (' + bufferData.messages.length + ' im Puffer, Cooldown aktiv).');
                } catch (e) {
                    console.error('[' + sourceInstance + ' - ' + sourceName +'] Fehler beim Schreiben des Puffers: ' + e.message);
                }
                return resolve('Message buffered');
            }

            if (bufferData.messages.length === 0) {
                return resolve('No messages in buffer');
            }

            const totalMessages = bufferData.messages.length;
            const eventWord = totalMessages > 1 ? 'se' : '';

            // create payload text
            let sortedMessages = {};

            bufferData.messages.forEach(item => {
                if(!sortedMessages[item.sourceName]) {
                    sortedMessages[item.sourceName] = [];
                }
                sortedMessages[item.sourceName].push({time: item.time, text: item.text});
            });       

            payloadText = '*' + sourceInstance + ' Fehler-Report (' + bufferData.messages.length + ' Ereignis' + (bufferData.messages.length === 1 ? '' : 'se') + '):*\n';

            Object.keys(sortedMessages).sort().forEach(sourceName => {                
                let messages = sortedMessages[sourceName];
                if(messages) {                
                    payloadText += '\n* Plugin: `' + sourceName + '` (' + messages.length + '):\n```';
                    messages.forEach(item => {
                        payloadText += '\n[' + item.time + '] ' + item.text;
                    });
                    
                    payloadText += '\n```\n';
                }
            });
        }

        // char-limitation for slack messages
        if (payloadText.length > 3500) {
            payloadText = payloadText.substring(0, 3400) + '\n... [Nachricht gekürzt, zu lang für Slack. Bitte Logs prüfen.]```';
        }

        const payload = JSON.stringify({ text: payloadText });

        try {
            const urlObj = new URL(webhookUrl);
            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                },
                timeout: 5000
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        console.error('[' + sourceInstance + '] Slack-Alert erfolgreich gesendet!');
                        try {
                            // reset buffer
                            fs.writeFileSync(bufferFile, JSON.stringify({ lastAlert: now, messages: [] }));
                        } catch (e) {
                            console.error('[' + sourceInstance + '] Fehler beim Aktualisieren der Status-Datei: ' + e.message);
                        }
                        resolve('Sent successfully');
                    } else {
                        console.error('[' + sourceInstance + '] Slack Webhook HTTP-Fehler: ' + res.statusCode + ', Body: ' + body);
                        resolve('HTTP Error ' + res.statusCode);
                    }                    
                });
            });

            req.on('error', (err) => {
                console.error('[' + sourceInstance + '] Fehler beim Senden des Slack Webhooks: ' + err.message);
                resolve('Network Error');
            });

            req.on('timeout', () => {
                req.destroy();
                console.error('[' + sourceInstance + '] Slack Webhook Timeout nach 5s');
                resolve('Timeout');
            });

            req.write(payload);
            req.end();

        } catch (err) {
            console.error('[' + sourceInstance + '] Ungültige Slack Webhook URL: ' + err.message);
            resolve('URL Parsing Error');
        }
    });
}

module.exports = { sendSlackAlert };