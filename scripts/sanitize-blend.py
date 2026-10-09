#!/usr/bin/env python3
"""Remove saved UI paths from a .blend without changing geometry or other data.

Uses the file's own SDNA schema, including Blender 5's large block headers.
Zstandard files need Python 3.14's compression.zstd or the zstd command.
Run again after saving a public source asset in Blender: its file browser can
remember local directories. This only changes the file, never Git history.
"""
import argparse
import gzip
import json
import math
import pathlib
import re
import shutil
import struct
import subprocess

HOME_PATH = re.compile(rb'(?:/Users/|/home/)[A-Za-z0-9_.@-]+|[A-Z]:\\Users\\[A-Za-z0-9_.@-]+')
UI_PATHS = {'FileGlobal': {'filename', 'filepath'}, 'FileSelectParams': {'dir'}}


def zstandard(data, decompress=False):
    try:
        from compression import zstd
        return zstd.decompress(data) if decompress else zstd.compress(data)
    except ImportError:
        command = shutil.which('zstd')
        if not command:
            raise ValueError('Zstandard files require Python 3.14 or the zstd command')
        result = subprocess.run([command, '-q', '--stdout', '-d' if decompress else '-3'], input=data, capture_output=True)
        if result.returncode:
            raise ValueError('Zstandard conversion failed')
        return result.stdout


def decode(data):
    if data.startswith(b'\x28\xb5\x2f\xfd'):
        return zstandard(data, True), 'zstd'
    if data.startswith(b'\x1f\x8b'):
        return gzip.decompress(data), 'gzip'
    return data, 'raw'


def blocks(data):
    if data.startswith(b'BLENDER17-01v'):
        position, pointer_size, order, header = 17, 8, '<', struct.Struct('<4siQqq')
        modern = True
    elif data.startswith(b'BLENDER') and data[7:8] in (b'_', b'-') and data[8:9] in (b'v', b'V'):
        position, pointer_size = 12, 8 if data[7:8] == b'-' else 4
        order = '<' if data[8:9] == b'v' else '>'
        header = struct.Struct(order + '4sI' + ('Q' if pointer_size == 8 else 'I') + 'II')
        modern = False
    else:
        raise ValueError('Unsupported Blender header')
    result = []
    while position + header.size <= len(data):
        values = header.unpack_from(data, position)
        code, schema, _, length, count = values if modern else (values[0], values[3], values[2], values[1], values[4])
        start = position + header.size
        if length < 0 or count < 0 or start + length > len(data):
            raise ValueError('Invalid Blender block size')
        result.append((code, start, length, schema, count))
        position = start + length
        if code == b'ENDB':
            if position != len(data):
                raise ValueError('Unexpected data after Blender end block')
            return result, pointer_size, order
    raise ValueError('Missing Blender end block')


def schema(data, order, pointer_size):
    position = 0

    def marker(value):
        nonlocal position
        if data[position:position + 4] != value:
            raise ValueError('Invalid Blender DNA marker')
        position += 4

    def number(kind):
        nonlocal position
        value = struct.unpack_from(order + kind, data, position)[0]
        position += struct.calcsize(kind)
        return value

    def strings():
        nonlocal position
        result = []
        for _ in range(number('I')):
            end = data.index(0, position)
            result.append(data[position:end].decode('ascii'))
            position = end + 1
        position = (position + 3) // 4 * 4
        return result

    marker(b'SDNA'); marker(b'NAME'); names = strings()
    marker(b'TYPE'); types = strings()
    marker(b'TLEN'); sizes = [number('H') for _ in types]
    position = (position + 3) // 4 * 4
    marker(b'STRC'); result = []
    for _ in range(number('I')):
        type_index, count = number('H'), number('H')
        fields, offset = [], 0
        for _ in range(count):
            field_type, name = number('H'), names[number('H')]
            length = (pointer_size if '*' in name else sizes[field_type]) * math.prod(map(int, re.findall(r'\[(\d+)\]', name)))
            fields.append((types[field_type], name.split('[', 1)[0], offset, length))
            offset += length
        result.append((types[type_index], sizes[type_index], offset, fields))
    return result


def sanitize(data):
    raw, compression = decode(data)
    entries, pointer_size, order = blocks(raw)
    dna = [raw[start:start + length] for code, start, length, _, _ in entries if code == b'DNA1']
    if len(dna) != 1:
        raise ValueError('Expected one Blender DNA block')
    structures = schema(dna[0], order, pointer_size)
    clean, changes = bytearray(raw), []
    for code, start, length, index, count in entries:
        if code in (b'DNA1', b'ENDB') or not 0 <= index < len(structures):
            continue
        name, size, computed, fields = structures[index]
        if name not in UI_PATHS:
            continue
        if size != computed or length != size * count:
            raise ValueError('Unexpected saved UI structure layout')
        for field_type, field_name, offset, field_size in fields:
            if field_type != 'char' or field_name not in UI_PATHS[name]:
                continue
            for item in range(count):
                begin = start + item * size + offset
                if any(clean[begin:begin + field_size]):
                    clean[begin:begin + field_size] = bytes(field_size)
                    changes.append({'structure': name, 'field': field_name, 'offset': begin, 'bytes': field_size})
    if HOME_PATH.search(clean):
        raise ValueError('Local-home metadata remains outside the supported UI fields; no file written')
    # Fixed-size overwrites preserve every block, pointer, mesh and material byte.
    assert len(clean) == len(raw)
    clean = bytes(clean)
    report = {'compression': compression, 'blocks': len(entries), 'decoded_bytes': len(raw), 'cleared_fields': changes, 'remaining_home_paths': 0}
    if not changes:
        return data, report
    encoded = zstandard(clean) if compression == 'zstd' else gzip.compress(clean, mtime=0) if compression == 'gzip' else clean
    assert decode(encoded)[0] == clean
    return encoded, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', type=pathlib.Path)
    parser.add_argument('--check', action='store_true', help='Report saved UI paths without writing; exit 1 if cleanup is needed')
    args = parser.parse_args()
    try:
        clean, report = sanitize(args.file.read_bytes())
        if report['cleared_fields'] and not args.check:
            temporary = args.file.with_name(args.file.name + '.sanitize-tmp')
            temporary.write_bytes(clean)
            temporary.replace(args.file)
        print(json.dumps({'file': args.file.name, 'check_only': args.check, **report}, indent=2))
        return 1 if args.check and report['cleared_fields'] else 0
    except (ValueError, OSError, struct.error) as error:
        # Do not print matching bytes or absolute filesystem paths.
        print(json.dumps({'error': type(error).__name__, 'message': str(error) if isinstance(error, ValueError) else 'Could not process Blender asset'}))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
