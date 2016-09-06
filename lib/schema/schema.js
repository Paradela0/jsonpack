var is = require('./../utilities/is');

var header = require('./header/header');

var boolean = require('./types/boolean');
var date = require('./types/date');
var double = require('./types/double');
var float = require('./types/float');
var int8 = require('./types/int8');
var int16 = require('./types/int16');
var int32 = require('./types/int32');
var int48 = require('./types/int48');
var string = require('./types/string');
var uint8 = require('./types/uint8');
var uint16 = require('./types/uint16');
var uint32 = require('./types/uint32');
var uint48 = require('./types/uint48');

module.exports = (() => {
	'use strict';

	const types = [
		boolean,
		date,
		double,
		float,
		int8,
		int16,
		int32,
		int48,
		string,
		uint8,
		uint16,
		uint32,
		uint48,
	].reduce((map, type) => {
		const name = type.getName();

		map[name] = type;

		return map;
	}, { });

	const allocateBuffer = (() => {
		if (is.fn(Buffer.allocUnsafe)) {
			return Buffer.allocUnsafe;
		} else {
			return function(size) {
				return new Buffer(size);
			};
		}
	})();

	return {
		create: (fields) => {
			const schema = fields.reduce((accumulator, field, index) => {
				const name = field.name;

				const definition = {
					name: name,
					index: index,
					type: types[field.type]
				};

				accumulator.map[name] = definition;
				accumulator.sequence.push(definition);

				return accumulator;
			}, { map: { }, sequence: [ ] });

			return {
				encode: (json) => {
					const sequence = schema.sequence;

					const names = Object.keys(json);
					const bytes = names.reduce((sum, name) => {
						let length;

						if (schema.map.hasOwnProperty(name)) {
							const value = json[name];

							if (is.null(value) || is.undefined(value)) {
								length = 0;
							} else {
								length = schema.map[name].type.getByteLength(value);
							}
						} else {
							length = 0;
						}

						return sum + 1 + length;
					}, 0);

					let buffer = allocateBuffer(bytes);
					let offset = 0;

					names.forEach((name) => {
						const definition = schema.map[name];
						const value = json[name];

						const headerByte = header.getByte(definition.index, value);
						const present = header.getValueIsPresent(headerByte);

						offset = uint8.write(buffer, headerByte, offset);

						if (present) {
							offset = definition.type.write(buffer, value, offset);
						}
					});

					return buffer;
				},
				decode: (buffer) => {
					let offset = 0;

					var json = { };
					var count = 0;

					while (offset < buffer.length) {
						const headerByte = uint8.read(buffer, offset);
						offset += uint8.getByteLength(headerByte);

						const index = header.getIndex(headerByte);
						const definition = schema.sequence[index];

						const present = header.getValueIsPresent(headerByte);

						let value;

						if (present) {
							const type = definition.type;

							value = type.read(buffer, offset);
							offset += type.getByteLength(value);
						} else {
							if (header.getValueIsUndefined(headerByte)) {
								value = undefined;
							} else {
								value = null;
							}
						}

						const name = definition.name;

						json[name] = value;
					}

					return json;
				}
			};
		}
	};
})();