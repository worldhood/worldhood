import pathlib
import runpy
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).parents[1]
helper = runpy.run_path(str(ROOT / 'scripts/prepare-release-history.py'))
fixture = runpy.run_path(str(ROOT / 'tests/sanitize-blend.test.py'))['fixture']
prepare, git, asset = helper['prepare'], helper['git'], helper['ASSET']


class ReleaseHistoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='worldhood-history-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        self.source, self.output = self.root / 'source', self.root / 'release.git'
        self.source.mkdir()
        git(self.source, 'init', '--initial-branch=main')
        git(self.source, 'config', 'user.name', 'Lasse (test fixture)')
        git(self.source, 'config', 'user.email', 'test@example.invalid')
        file = self.source / asset
        file.parent.mkdir(parents=True)
        file.write_bytes(fixture()[0])
        (self.source / 'README.md').write_text('Original creator credit\n')
        git(self.source, 'add', '.')
        git(self.source, '-c', 'commit.gpgsign=false', 'commit', '-m', 'Original model')

    def test_all_branches_are_clean_and_source_dirty_work_is_untouched(self):
        git(self.source, 'branch', 'feature')
        (self.source / 'README.md').write_text('Updated creator credit\n')
        git(self.source, 'add', 'README.md')
        git(self.source, '-c', 'commit.gpgsign=false', 'commit', '-m', 'Explain the project')
        (self.source / 'README.md').write_text('Staged work\n')
        git(self.source, 'add', 'README.md')
        (self.source / 'README.md').write_text('Unstaged work\n')
        (self.source / 'untracked.txt').write_text('Keep me\n')
        before = {str(f.relative_to(self.source)): f.read_bytes() for f in self.source.rglob('*') if f.is_file()}
        original_blob = git(self.source, 'rev-parse', 'HEAD:' + asset).decode().strip()
        report = prepare(self.source, self.output)
        after = {str(f.relative_to(self.source)): f.read_bytes() for f in self.source.rglob('*') if f.is_file()}
        self.assertEqual(before, after)
        self.assertEqual(report['commits'], 2)
        self.assertEqual(set(report['refs']), {'refs/heads/main', 'refs/heads/feature'})
        self.assertTrue(report['source_still_at_snapshot'])
        self.assertFalse((self.output / 'objects/info/alternates').exists())
        self.assertEqual(git(self.output, 'remote').strip(), b'')
        for branch in ['main', 'feature']:
            clean = git(self.output, 'show', branch + ':' + asset)
            self.assertFalse(helper['sanitize'](clean)[1]['cleared_fields'])
        self.assertEqual(git(self.output, 'show', 'main:README.md'), b'Updated creator credit\n')
        self.assertNotEqual(report['prepared_head'], report['source_head'])
        self.assertNotEqual(subprocess.run(['git', '-C', str(self.output), 'cat-file', '-e', original_blob], capture_output=True).returncode, 0)

    def test_existing_or_nested_output_is_rejected_without_overwriting(self):
        self.output.mkdir()
        marker = self.output / 'keep.txt'
        marker.write_text('Keep me')
        with self.assertRaisesRegex(ValueError, 'new directory'):
            prepare(self.source, self.output)
        self.assertEqual(marker.read_text(), 'Keep me')
        nested = self.source / 'release.git'
        with self.assertRaisesRegex(ValueError, 'separate'):
            prepare(self.source, nested)
        self.assertFalse(nested.exists())

    def test_tags_require_review_before_any_output_is_created(self):
        git(self.source, 'tag', 'v1')
        with self.assertRaisesRegex(ValueError, 'Tags require'):
            prepare(self.source, self.output)
        self.assertFalse(self.output.exists())

    def test_signatures_are_rejected_instead_of_invalidated(self):
        raw = git(self.source, 'cat-file', 'commit', 'HEAD')
        header, body = raw.split(b'\n\n', 1)
        signed = header + b'\ngpgsig synthetic test signature\n\n' + body
        oid = git(self.source, 'hash-object', '-w', '-t', 'commit', '--stdin', data=signed).decode().strip()
        git(self.source, 'update-ref', 'refs/heads/main', oid)
        with self.assertRaisesRegex(ValueError, 'Signed commits require'):
            prepare(self.source, self.output)
        self.assertFalse(self.output.exists())


if __name__ == '__main__':
    unittest.main()
