import pino from "pino";
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

const logger = pino(
  {
    level: "info",
  },
  pino.multistream([
    { stream: pino.destination("server.log") },
    { stream: bufferStream },
    { stream: process.stdout },
  ]),
);

export const getLogs = () => logBuffer;

export default logger;
