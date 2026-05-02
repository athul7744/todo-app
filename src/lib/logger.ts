const PREFIX = '[PowerSync]';
const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  info: (...args: any[]) => { if (isDev) console.log(PREFIX, ...args); },
  warn: (...args: any[]) => { if (isDev) console.warn(PREFIX, ...args); },
  error: (...args: any[]) => console.error(PREFIX, ...args),
};
