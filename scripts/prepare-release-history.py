#!/usr/bin/env python3
"""Prepare a separate bare release repository with the Blender UI paths cleared.

Reads the source repository; never changes its refs, index, worktree or remotes.
Copies local branches only. Tags, signed commits and non-SHA-1 repositories need
a separate review and are rejected. Uncommitted work is deliberately not copied.
Requires Git and, for compressed Blender assets, Python 3.14 or the zstd command.
"""
import argparse
import hashlib
import json
import os
import pathlib
import runpy
import subprocess
import tempfile

ASSET = 'assets/source/senate-pavilions.blend'
sanitize = runpy.run_path(str(pathlib.Path(__file__).with_name('sanitize-blend.py')))['sanitize']


def git(where, *args, data=None):
    result = subprocess.run(['git', '-C', str(where), *args], input=data,
                            capture_output=True, env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'})
    if result.returncode:
        # Git errors can include local paths or remote credentials. Do not echo them.
        raise ValueError('Git operation failed: ' + args[0])
    return result.stdout


def refs_at(source):
    return {line.split()[1]: line.split()[0] for line in
            git(source, 'for-each-ref', '--format=%(objectname) %(refname)',
                'refs/heads', 'refs/tags').decode().splitlines()}


def metadata(raw):
    header, body = raw.split(b'\n\n', 1)
    return hashlib.sha256(b'\n'.join(line for line in header.split(b'\n')
                                   if not line.startswith((b'tree ', b'parent '))) + b'\n\n' + body).hexdigest()


def prepare(source, output=None):
    source = pathlib.Path(source).resolve()
    gitdir = pathlib.Path(git(source, 'rev-parse', '--absolute-git-dir').decode().strip()).resolve()
    if git(source, 'rev-parse', '--show-object-format').strip() != b'sha1':
        raise ValueError('This tool supports SHA-1 repositories only')
    refs = refs_at(source)
    if any(ref.startswith('refs/tags/') for ref in refs):
        raise ValueError('Tags require a separate review; no output created')
    head_ref = git(source, 'symbolic-ref', 'HEAD').decode().strip()
    if head_ref not in refs:
        raise ValueError('Source HEAD must name a local branch')
    head = refs[head_ref]
    commits = git(source, 'rev-list', '--reverse', '--topo-order', *refs.values()).decode().splitlines()
    commit_bytes = {oid: git(source, 'cat-file', 'commit', oid) for oid in commits}
    if any(any(line.startswith((b'gpgsig ', b'mergetag ')) for line in raw.split(b'\n\n', 1)[0].split(b'\n'))
           for raw in commit_bytes.values()):
        raise ValueError('Signed commits require a separate review; no output created')
    if output is None:
        target = pathlib.Path(tempfile.mkdtemp(prefix='worldhood-release-history-', suffix='.git'))
    else:
        target = pathlib.Path(output).absolute()
        if target.exists() or target.is_symlink():
            raise ValueError('Output must be a new directory')
        target = target.resolve()
        if any(target == p or p in target.parents or target in p.parents for p in (source, gitdir)):
            raise ValueError('Output must be separate from the source repository')
        target.mkdir(mode=0o700)
    git(target, 'init', '--bare', '--initial-branch=' + head_ref.removeprefix('refs/heads/'))
    objects = pathlib.Path(git(source, 'rev-parse', '--git-path', 'objects').decode().strip())
    if not objects.is_absolute():
        objects = source / objects
    alternate = target / 'objects/info/alternates'
    alternate.write_text(str(objects.resolve()) + '\n')

    old_blobs = {}
    for oid in commits:
        record = git(source, 'ls-tree', oid, '--', ASSET).decode().strip()
        if record:
            blob = record.split()[2]
            old_blobs[blob] = old_blobs.get(blob, 0) + 1
    replacements, asset_changes = {}, []
    for old, count in old_blobs.items():
        clean, report = sanitize(git(source, 'cat-file', 'blob', old))
        if not report['cleared_fields']:
            continue
        new = git(target, 'hash-object', '-w', '--stdin', data=clean).decode().strip()
        replacements[old] = new
        asset_changes.append({'original_blob': old, 'sanitized_blob': new, 'commits_using_blob': count,
                              'cleared_fields': [{'structure': f['structure'], 'field': f['field']}
                                                 for f in report['cleared_fields']]})

    trees = {}

    def rewrite_tree(oid):
        if oid in trees:
            return trees[oid]
        raw, out, position = git(source, 'cat-file', 'tree', oid), bytearray(), 0
        while position < len(raw):
            end = raw.index(0, position)
            entry, old = raw[position:end], raw[end + 1:end + 21].hex()
            new = rewrite_tree(old) if entry.split(b' ', 1)[0] == b'40000' else replacements.get(old, old)
            out.extend(entry + b'\0' + bytes.fromhex(new))
            position = end + 21
        result = oid if bytes(out) == raw else git(target, 'hash-object', '-w', '-t', 'tree', '--stdin', data=bytes(out)).decode().strip()
        trees[oid] = result
        return result

    mapping = {}
    for old in commits:
        header, body = commit_bytes[old].split(b'\n\n', 1)
        rewritten = []
        for line in header.split(b'\n'):
            if line.startswith(b'tree '):
                line = b'tree ' + rewrite_tree(line[5:].decode()).encode()
            elif line.startswith(b'parent '):
                line = b'parent ' + mapping[line[7:].decode()].encode()
            rewritten.append(line)
        clean = b'\n'.join(rewritten) + b'\n\n' + body
        mapping[old] = git(target, 'hash-object', '-w', '-t', 'commit', '--stdin', data=clean).decode().strip()
    for ref, old in refs.items():
        git(target, 'update-ref', ref, mapping[old])
    git(target, 'symbolic-ref', 'HEAD', head_ref)
    git(target, 'repack', '-a', '-d')
    alternate.unlink()
    git(target, 'fsck', '--full', '--strict')
    for old, new in mapping.items():
        if metadata(git(target, 'cat-file', 'commit', new)) != metadata(commit_bytes[old]):
            raise ValueError('Commit metadata validation failed')
        before = git(source, 'ls-tree', '-r', '-z', old).split(b'\0')
        after = git(target, 'ls-tree', '-r', '-z', new).split(b'\0')
        if len(before) != len(after):
            raise ValueError('History tree length validation failed')
        for a, b in zip(before, after):
            if a != b and (a.split(b'\t', 1)[1] != ASSET.encode() or b.split(b'\t', 1)[1] != ASSET.encode()):
                raise ValueError('Unrelated historical file changed')
    for old in replacements:
        result = subprocess.run(['git', '-C', str(target), 'cat-file', '-e', old], capture_output=True)
        if result.returncode == 0:
            raise ValueError('Original private asset blob retained in prepared repository')
    report = {'source_head': head, 'prepared_head': mapping[head],
              'source_still_at_snapshot': refs_at(source) == refs,
              'commits': len(commits), 'refs': list(refs), 'asset_changes': asset_changes,
              'only_asset_changes': True, 'creator_and_commit_metadata_preserved': True,
              'standalone_repository': True, 'original_blobs_absent': True,
              'uncommitted_work_copied': False, 'remote_refs_copied': False,
              'prepared_repository': str(target), 'commit_map': mapping}
    (target / 'release-history-report.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=pathlib.Path, default=pathlib.Path.cwd())
    parser.add_argument('--output', type=pathlib.Path, help='A new directory outside the source repository; defaults to a private temporary directory')
    args = parser.parse_args()
    try:
        report = prepare(args.source, args.output)
        print(json.dumps({k: v for k, v in report.items() if k != 'commit_map'}, indent=2))
        return 0
    except (ValueError, OSError) as error:
        print(json.dumps({'error': type(error).__name__, 'message': str(error) if isinstance(error, ValueError) else 'Could not prepare the separate repository'}))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
