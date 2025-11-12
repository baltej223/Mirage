import pino from "pino";
import pretty from "pino-pretty";
import { Writable } from "stream";

const logBuffer: string[] = [];
const MAX_BUFFER_SIZE = 500;

const bufferStream = new Writable({
  write(chunk, encoding, callback) {
    if (logBuffer.length >= MAX_BUFFER_SIZE) {
      logBuffer.shift();
    }
    logBuffer.push(chunk.toString());
    callback();
  },
});

// Create pretty stream for console with custom formatting
const prettyStream = pretty({
  colorize: true,
  translateTime: "HH:MM:ss",
  ignore: "pid,hostname",
  messageFormat: "{msg}",
  customPrettifiers: {
    time: (timestamp) => `${timestamp}`,
  },
  customColors: "info:green,warn:yellow,error:red,debug:blue,trace:gray",
});

const logger = pino(
  {
    level: "info",
  },
  pino.multistream([
    { stream: pino.destination("server.log") }, // Raw JSON to file
    { stream: bufferStream }, // Raw JSON to buffer
    { stream: prettyStream }, // Pretty formatted to console
  ]),
);

export const getLogs = () => logBuffer;

export default logger;
