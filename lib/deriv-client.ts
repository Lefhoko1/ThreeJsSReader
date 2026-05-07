import WebSocket from 'ws';

export class DerivClient {
    constructor(config) {
        this.config = config;
        this.ws = null;
        this.messageId = 1;
        this.pendingRequests = new Map();
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(${this.config.wsUrl}?app_id=);
            this.ws.on('open', async () => {
                await this.send({ authorize: this.config.token });
                resolve();
            });
            this.ws.on('error', reject);
        });
    }

    async send(request) {
        return new Promise((resolve, reject) => {
            const req_id = this.messageId++;
            const message = { ...request, req_id };
            this.pendingRequests.set(req_id, { resolve, reject });
            this.ws.send(JSON.stringify(message));
        });
    }

    async getBalance() {
        const response = await this.send({ balance: 1 });
        return response.balance?.balance || 0;
    }

    async buyContract(params) {
        return await this.send({
            buy: params.amount,
            price: params.amount,
            parameters: {
                amount: params.amount,
                contract_type: params.contract_type,
                duration: params.duration,
                duration_unit: params.duration_unit,
                symbol: params.symbol
            }
        });
    }

    disconnect() {
        if (this.ws) this.ws.close();
    }
}
