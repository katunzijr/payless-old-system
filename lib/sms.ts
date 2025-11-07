import { ApiResponse } from '@/types';
// import { formatAndValidateToken } from '@/lib/utils';

export interface SMSConfig {
  apiKey: string;
  apiSecret?: string;
  baseUrl: string;
  sender?: string;
}

export interface SMSMessage {
  to: string;
  message: string;
  sender?: string;
}

export interface SMSTemplate {
  message: string;
}

export interface SendSMSParams {
  to: string;
  message?: string;
  template?: 'password-reset-otp' | 'verification' | 'notification' | 'clear-credit' | 'clear-tamper' | 'issue-credit-postpaid' | 'issue-credit-domestic';
  templateData?: Record<string, any>;
}

class SMSService {
  private config: SMSConfig | null = null;
  private isConfigured = false;

  constructor() {
    this.initializeConfig();
  }

  private initializeConfig() {
    try {
      const smsConfig: SMSConfig = {
        apiKey: process.env.SMS_API_KEY || '',
        apiSecret: process.env.SMS_PASSWORD || '',
        baseUrl: process.env.SMS_BASE_URL || '',
        sender: process.env.SMS_SENDER || 'Payless'
      };

      if (!smsConfig.apiKey || !smsConfig.baseUrl) {
        console.warn('SMS service not configured: Missing API credentials');
        return;
      }

      this.config = smsConfig;
      this.isConfigured = true;
      
      console.log('SMS service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SMS service:', error instanceof Error ? error.message : error);
    }
  }

  private getTemplate(templateName: string, data: Record<string, any>): SMSTemplate {
    const templates: Record<string, (data: Record<string, any>) => SMSTemplate> = {
      'password-reset-otp': (data) => ({
        message: `Payless Password Reset OTP: \n\nYour OTP code is ${data.otp} \n\nThis code expires in ${data.expiresIn || '15 minutes'}. DO NOT share this code with anyone. \nIf you didn't request this, please ignore this message.`
      }),
      'verification': (data) => ({
        message: `Payless Verification: Your verification code is ${data.code} This code expires in ${data.expiresIn || '10 minutes'}.`
      }),
      'notification': (data) => ({
        message: data.message || 'You have a new notification from Payless.'
      }),
      // 'clear-credit': (data) => ({
      //   message: `Payless Clear Credit: \nYour clear credit token for meter ${data.meterNumber || 'N/A'} is: \n\n${formatAndValidateToken(data.token) || 'N/A'} \n\nPlease use this token to clear credit on your meter.`
      // }),
      // 'clear-tamper': (data) => ({
      //   message: `Payless Clear Tamper: \nYour clear tamper token for meter ${data.meterNumber || 'N/A'} is: \n\n${formatAndValidateToken(data.token) || 'N/A'} \n\nPlease use this token to clear tamper on your meter.`
      // }),
      // 'issue-credit-postpaid': (data) => ({
      //   message: `Token: ${formatAndValidateToken(data.token)} \nMeter # ${data.meterNumber} \nName: FUMBA MOYONI 2R-5 \nReceipt: 2609468306 \nAmount: 200000.00 \nUnits: 579.7kWh \n\n**Contact Us 0750013030 or 0777901467 **`
      // }),
      // 'issue-credit-domestic': (data) => ({
      //   message: `MUHIMU SANA ANZA KUWEKA LUKU: \n6003 6831 4771 8012 5054 \n\nMALIZIA KUWEKA PASSCODE: \n${formatAndValidateToken(data.token)} \n\nMita # 0202300058122 \nJina: KILIGITO-1 HOUSE \nRisiti: 4908186799 \nKiasi: 3000.00 \nUnits: 8.5kWh \n\n**Piga Bure 0750013030 na 0777901467**`
      // }),
    };

    const templateFn = templates[templateName];
    if (!templateFn) {
      throw new Error('SMS template not found');
    }
    return templateFn(data);
  }

  private async sendSMSRequest(smsData: SMSMessage): Promise<ApiResponse<{ messageId?: string }>> {
    if (!this.config) {
      throw new Error('SMS service not configured');
    }

    try {
      // Payless SMS API implementation
      // Since standard fetch doesn't support GET with JSON body, 
      // we'll convert the JSON to query parameters
      const requestData = {
        api_key: this.config.apiKey,
        password: this.config.apiSecret || '',
        action: 'send_sms',
        from: smsData.sender || this.config.sender || 'Payless',
        to: smsData.to,
        message: smsData.message,
        _id: Date.now().toString() // Generate unique ID for tracking
      };

      // Convert JSON to query parameters for GET request
      const queryParams = new URLSearchParams();
      Object.entries(requestData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });

      const url = `${this.config.baseUrl}?${queryParams.toString()}`;

      console.log('SMS Request URL:', url);
      console.log('SMS Request Data:', requestData);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Payless-SMS-Service/1.0'
        }
      });

      console.log('SMS Response Status:', response.status);

      const responseText = await response.text();
      console.log('SMS Response Body:', responseText);

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { message: responseText || 'Unknown error' };
        }
        throw new Error(errorData.message || `SMS API error: ${response.status} - ${responseText}`);
      }

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        // If response is not JSON, treat as success with text response
        responseData = { message: responseText, _id: requestData._id };
      }

      return {
        success: true,
        message: 'SMS sent successfully',
        data: { messageId: responseData.messageId || responseData._id || requestData._id }
      };
    } catch (error) {
      console.error('SMS sending error:', error instanceof Error ? error.message : error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send SMS',
      };
    }
  }

  async sendSMS(params: SendSMSParams): Promise<ApiResponse<{ messageId?: string }>> {
    try {
      if (!this.isConfigured || !this.config) {
        return {
          success: false,
          message: 'SMS service is not configured. Please check SMS API settings.',
        };
      }

      let smsContent: { message: string };

      if (params.template && params.templateData) {
        const template = this.getTemplate(params.template, params.templateData);
        smsContent = { message: template.message };
      } else {
        smsContent = { message: params.message || 'Notification from Payless' };
      }

      const smsData: SMSMessage = {
        to: params.to,
        message: smsContent.message
      };
      
      if (this.config.sender) {
        smsData.sender = this.config.sender;
      }

      return await this.sendSMSRequest(smsData);
    } catch (error) {
      console.error('Failed to send SMS:', error instanceof Error ? error.message : error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send SMS'
      };
    }
  }

  async sendPasswordResetOTP(phoneNumber: string, otp: string): Promise<void> {
    // Fire and forget - don't wait for the SMS to be sent
    this.sendSMS({
      to: phoneNumber,
      template: 'password-reset-otp',
      templateData: {
        otp: otp,
        expiresIn: '15 minutes'
      }
    }).catch(error => {
      console.error('Failed to send password reset OTP SMS:', error);
    });
  }

  async sendVerificationSMS(phoneNumber: string, verificationCode: string): Promise<ApiResponse<{ messageId?: string }>> {
    return this.sendSMS({
      to: phoneNumber,
      template: 'verification',
      templateData: {
        code: verificationCode,
        expiresIn: '10 minutes'
      }
    });
  }

  async sendTestSMS(phoneNumber: string, message: string = 'Test message from Payless SMS Service'): Promise<ApiResponse<{ messageId?: string }>> {
    return this.sendSMS({
      to: phoneNumber,
      message: message
    });
  }

}

export const smsService = new SMSService();
