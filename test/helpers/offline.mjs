import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dgram from 'node:dgram';
import { syncBuiltinESMExports } from 'node:module';

// Defense against accidental provider execution, not a sandbox for hostile test code.
const blocked = () => { throw Object.assign(new Error('test_network_forbidden'), { code: 'TEST_NETWORK_FORBIDDEN' }); };
net.connect = net.createConnection = net.Socket.prototype.connect = blocked;
tls.connect = blocked;
http.request = http.get = https.request = https.get = blocked;
dgram.createSocket = blocked;
globalThis.fetch = async () => blocked();
syncBuiltinESMExports();
