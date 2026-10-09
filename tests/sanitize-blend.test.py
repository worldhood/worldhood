import pathlib
import runpy
import struct
import unittest

helper = runpy.run_path(str(pathlib.Path(__file__).parents[1] / 'scripts/sanitize-blend.py'))
sanitize, decode = helper['sanitize'], helper['decode']


def fixture(modern=True, little=True, pointers=8, unexpected=False):
    order = '<' if little else '>'
    header = b'BLENDER17-01v0502' if modern else b'BLENDER' + (b'-' if pointers == 8 else b'_') + (b'v' if little else b'V') + b'405'

    def block(code, value, schema):
        fields = (code, schema, 1, len(value), 1) if modern else (code, len(value), 1, schema, 1)
        return struct.pack('<4siQqq' if modern else order + '4sI' + ('Q' if pointers == 8 else 'I') + 'II', *fields) + value

    def strings(marker, values):
        value = marker + struct.pack(order + 'I', len(values)) + b'\0'.join(values) + b'\0'
        return value + bytes(-len(value) % 4)

    dna = b'SDNA' + strings(b'NAME', [b'dir[64]', b'raw[64]']) + strings(b'TYPE', [b'char', b'FileSelectParams', b'Mesh'])
    dna += b'TLEN' + struct.pack(order + '3H', 1, 64, 64) + bytes(2)
    dna += b'STRC' + struct.pack(order + 'I8H', 2, 1, 1, 0, 0, 2, 1, 0, 1)
    saved = b'/Users/example-private/Desktop/project/'.ljust(64, b'\0')
    geometry = (b'/home/private/unknown-field' if unexpected else bytes(range(64))).ljust(64, b'\0')
    return header + block(b'DATA', saved, 0) + block(b'ME\0\0', geometry, 1) + block(b'DNA1', dna, 0) + block(b'ENDB', b'', 0), geometry


class SanitizeBlendTests(unittest.TestCase):
    def test_current_and_legacy_layouts_preserve_every_non_ui_byte(self):
        for modern, little, pointers in [(True, True, 8), (False, True, 8), (False, True, 4), (False, False, 4)]:
            with self.subTest(modern=modern, little=little, pointers=pointers):
                original, geometry = fixture(modern, little, pointers)
                clean, report = sanitize(original)
                self.assertEqual(len(original), len(clean))
                self.assertIn(geometry, clean)
                self.assertEqual(len(report['cleared_fields']), 1)
                field = report['cleared_fields'][0]
                begin, end = field['offset'], field['offset'] + field['bytes']
                self.assertEqual(original[:begin], clean[:begin])
                self.assertEqual(original[end:], clean[end:])
                self.assertEqual(sanitize(clean)[0], clean)
                self.assertEqual(sanitize(clean)[1]['cleared_fields'], [])

    def test_unknown_private_metadata_is_rejected_instead_of_silently_cleared(self):
        original, _ = fixture(unexpected=True)
        with self.assertRaisesRegex(ValueError, 'outside the supported UI fields'):
            sanitize(original)

    def test_truncated_asset_is_rejected(self):
        original, _ = fixture()
        with self.assertRaises(ValueError):
            sanitize(original[:-1])

    def test_real_asset_is_already_clean_and_round_trips(self):
        asset = pathlib.Path(__file__).parents[1] / 'assets/source/senate-pavilions.blend'
        if not asset.exists():
            self.skipTest('Local Blender working files are excluded from the public repository')
        original = asset.read_bytes()
        clean, report = sanitize(original)
        self.assertEqual(clean, original)
        self.assertEqual(report['cleared_fields'], [])
        self.assertFalse(helper['HOME_PATH'].search(decode(clean)[0]))


if __name__ == '__main__':
    unittest.main()
