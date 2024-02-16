'use strict';

const net = require('net');
const EventEmitter = require('events');

const HOST = '127.0.0.1';
var port;

class Bridge extends EventEmitter {
	constructor() {
		super();

		var server = net.createServer((socket) => {
			this.socket = socket; // Allow multiple sockets?

			console.log("bridge: connection to Spring established");

			socket.on('data', (data) => {
				const msgs = data.toString().split('\n');
				msgs.forEach((msg) => {
					if (msg == '') {
						return;
					}
					//log.debug(msg);
					var obj;
					try {
						obj = JSON.parse(msg);
					} catch(e) {
						console.log("bridge: failed to parse JSON message: %s", msg);
						//log.error(e);
						return;
					}

					const name = obj.name;
					const command = obj.command;
					this._executeCommand(name, command);
				});
			});

			socket.on('close', () => {
				this.socket = null;
				console.log("bridge: connection to Spring lost.");
			});

			socket.on('error', (err) => {
				this.socket = null;
				console.log("bridge: connection with Spring lost due to error: %s", err);
			});
		});


		server.on('listening', (e) => {
			port = server.address().port;

			console.log("bridge: listening on port: %s:%s", HOST, port);
			this.emit('listening', e);
		});


		server.on('error', (e) => {
			this.socket = null;
			console.log("server error: %s", e);
		});

		server.listen(0, HOST);
		this.server = server;
	}

	send(name, command) {
		if (this.socket == null) {
			// Not connected to Spring: cannot send command.
			// log.debug('bridge: not connected to Spring: cannot send command.');
			return;
		}

		if (command == undefined) {
			command = {};
		}
		const json = JSON.stringify({
			name: name,
			command: command
		});
		//log.debug('launcher->spring', json);
		this.socket.write(json + '\n');
	}

	_executeCommand(name, command) {
		//log.debug('spring->launcher', name, command);
		this.emit(name, command);
	}
}

const bridge = new Bridge();

module.exports = {
	bridge: bridge,
};
