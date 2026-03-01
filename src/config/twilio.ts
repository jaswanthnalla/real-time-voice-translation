import twilio from 'twilio';
import config from './index';

let twilioClient: twilio.Twilio | null = null;

export function getTwilioClient(): twilio.Twilio {
  if (!twilioClient) {
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return twilioClient;
}

export function getTwilioConfig() {
  return {
    accountSid: config.twilio.accountSid,
    authToken: config.twilio.authToken,
    phoneNumber: config.twilio.phoneNumber,
    mediaStreamUrl: config.twilio.mediaStreamUrl,
  };
}
