import WebSocket from 'ws';

export interface DerivConfig {
  appId: number;
  token: string;
  wsUrl: string;
}

export interface BinaryOptionsParams {
  amount: number;
  contract_type: 'CALL' | 'PUT';
  duration: number;
  duration_unit: 't' | 's' | 'm' | 'h';
  symbol: string;
  barrier?: number;
  basis?: 'stake' | 'payout';
}

export interface TradeResult {
  success: boolean;
  contract_id?: string;
  buy_price?: number;
  sell_price?: number;
  payout?: number;
  profit?: number;
  start_time?: string;
  expiry_time?: string;
  balance?: number;
  error?: string;
  timestamp: string;
}

export class DerivTradingService {
  private ws: WebSocket | null = null;
  private config: DerivConfig;
  private messageId: number = 1;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  private isConnected: boolean = false;

  constructor(config: DerivConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return; // Already connected
    }

    return new Promise((resolve, reject) => {
      const url = `${this.config.wsUrl}?app_id=${this.config.appId}`;
      this.ws = new WebSocket(url);

      this.ws.on('open', async () => {
        try {
          const authResponse = await this.send({ authorize: this.config.token });
          if (authResponse.error) {
            reject(new Error(`Authentication failed: ${authResponse.error.message}`));
          }
          console.log('✅ Authenticated with Deriv');
          this.isConnected = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        const response = JSON.parse(data.toString());
        const reqId = response.req_id;

        if (reqId && this.pendingRequests.has(reqId)) {
          const { resolve, reject } = this.pendingRequests.get(reqId)!;
          this.pendingRequests.delete(reqId);

          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response);
          }
        }
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('WebSocket connection closed');
        this.isConnected = false;
        this.ws = null;
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  private async send(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const req_id = this.messageId++;
      const message = { ...request, req_id };

      this.pendingRequests.set(req_id, { resolve, reject });
      this.ws.send(JSON.stringify(message));

      // Timeout after 15 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(req_id)) {
          this.pendingRequests.delete(req_id);
          reject(new Error('Request timeout'));
        }
      }, 15000);
    });
  }

  async getBalance(): Promise<number> {
    const response = await this.send({ balance: 1 });
    return response.balance?.balance || 0;
  }

  async getProposal(params: {
    amount: number;
    basis: 'stake' | 'payout';
    contract_type: 'CALL' | 'PUT';
    currency: 'USD';
    duration: number;
    duration_unit: 't' | 's' | 'm' | 'h';
    symbol: string;
  }): Promise<any> {
    const proposal = await this.send({
      proposal: 1,
      amount: params.amount,
      basis: params.basis,
      contract_type: params.contract_type,
      currency: params.currency,
      duration: params.duration,
      duration_unit: params.duration_unit,
      symbol: params.symbol
    });

    if (proposal.error) {
      throw new Error(proposal.error.message);
    }

    return proposal;
  }

  async placeTrade(params: BinaryOptionsParams): Promise<TradeResult> {
    try {
      // Step 1: Get proposal
      const proposal = await this.getProposal({
        amount: params.amount,
        basis: params.basis || 'stake',
        contract_type: params.contract_type,
        currency: 'USD',
        duration: params.duration,
        duration_unit: params.duration_unit,
        symbol: params.symbol
      });

      console.log(`📊 Proposal received: Ask price = ${proposal.proposal.ask_price}`);

      // Step 2: Execute buy
      const buyResponse = await this.send({
        buy: proposal.proposal.id,
        price: proposal.proposal.ask_price
      });

      if (buyResponse.error) {
        return {
          success: false,
          error: buyResponse.error.message,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        contract_id: buyResponse.buy.contract_id,
        buy_price: buyResponse.buy.buy_price,
        sell_price: buyResponse.buy.sell_price,
        payout: buyResponse.buy.payout,
        profit: buyResponse.buy.profit,
        start_time: buyResponse.buy.start_time,
        expiry_time: buyResponse.buy.expiry_time,
        balance: buyResponse.balance?.balance,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async sellContract(contractId: string, price: number): Promise<TradeResult> {
    try {
      const response = await this.send({
        sell: contractId,
        price: price
      });

      if (response.error) {
        return {
          success: false,
          error: response.error.message,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        contract_id: contractId,
        sell_price: response.sell.sold_for,
        profit: response.sell.profit,
        balance: response.balance?.balance,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  isConnectedToDeriv(): boolean {
    return this.isConnected;
  }
}