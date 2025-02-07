const { TeamsActivityHandler, MessageFactory } = require('botbuilder');
const { TableClient } = require('@azure/data-tables');
const fetch = require('node-fetch');

class ApprovalBot extends TeamsActivityHandler {
    constructor() {
        super();
        
        // Initialize Table Storage client
        this.tableClient = null;
        this.initializeStorage().then(() => {
            console.log('Storage initialized successfully');
        }).catch(err => {
            console.error('Error initializing storage:', err);
        });
    }

    async initializeStorage() {
        try {
            this.tableClient = TableClient.fromConnectionString(
                process.env.AzureStorageConnectionString,
                'conversationreferences'
            );
            await this.tableClient.createTable();
            console.log('Storage table created or exists');
        } catch (err) {
            console.error('Error creating table:', err);
            throw err;
        }
    }

    // Handle Adaptive Card Action.Execute
    async onInvokeActivity(context) {
        console.log('Invoke Activity:', JSON.stringify(context.activity, null, 2));

        if (context.activity.name === 'adaptiveCard/action') {
            const actionData = context.activity.value.action.data;
            
            try {
                const functionUrl = process.env.FUNCTIONAPP_URL;
                const functionKey = process.env.FUNCTIONAPP_KEY;

                const functionParams = new URLSearchParams({
                    decision: actionData.decision,
                    requestId: actionData.requestId,
                    ticketId: actionData.ticketNumber
                }).toString();

                console.log('Calling function with params:', functionParams);

                const response = await fetch(`${functionUrl}?${functionParams}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-functions-key': functionKey
                    }
                });

                const responseBody = await response.json();
                console.log('Function response:', JSON.stringify(responseBody, null, 2));

                if (response.ok) {
                    return {
                        status: 200,
                        body: {
                            statusCode: 200,
                            type: 'application/vnd.microsoft.activity.message',
                            value: ` Request ${actionData.decision} successfully processed.`
                        }
                    };
                } else {
                    console.error('Function call failed:', responseBody);
                    return {
                        status: 500,
                        body: {
                            statusCode: 500,
                            type: 'application/vnd.microsoft.activity.message',
                            value: ` Error processing request: ${JSON.stringify(responseBody)}`
                        }
                    };
                }
            } catch (error) {
                console.error('Error processing card action:', error);
                return {
                    status: 500,
                    body: {
                        statusCode: 500,
                        type: 'application/vnd.microsoft.activity.message',
                        value: ` Error: ${error.message}`
                    }
                };
            }
        }
        return null;
    }

    async onConversationUpdateActivity(context) {
        await this.addConversationReference(context.activity);
        await super.onConversationUpdateActivity(context);
    }

    async addConversationReference(activity) {
        if (!activity?.conversation?.id) {
            console.log('Invalid activity format:', activity);
            return;
        }

        try {
            if (!this.tableClient) {
                await this.initializeStorage();
            }

            const entity = {
                partitionKey: 'channel',
                rowKey: activity.conversation.id,
                reference: JSON.stringify({
                    channelId: activity.channelId,
                    serviceUrl: activity.serviceUrl,
                    conversation: {
                        id: activity.conversation.id,
                        name: activity.conversation.name,
                        conversationType: activity.conversation.conversationType,
                        isGroup: activity.conversation.isGroup,
                        tenantId: activity.conversation.tenantId
                    },
                    bot: activity.recipient,
                    tenantId: activity.conversation.tenantId
                })
            };

            await this.tableClient.upsertEntity(entity);
            console.log('Stored conversation reference');
        } catch (err) {
            console.error('Error storing conversation reference:', err);
        }
    }

    async getAllConversationReferences() {
        try {
            if (!this.tableClient) {
                await this.initializeStorage();
            }

            const references = [];
            const entities = this.tableClient.listEntities({
                queryOptions: { filter: "PartitionKey eq 'channel'" }
            });

            for await (const entity of entities) {
                if (entity.reference) {
                    try {
                        const reference = JSON.parse(entity.reference);
                        references.push(reference);
                    } catch (err) {
                        console.error('Error parsing reference:', err);
                    }
                }
            }

            return references;
        } catch (err) {
            console.error('Error retrieving conversation references:', err);
            return [];
        }
    }
}

module.exports = ApprovalBot;
