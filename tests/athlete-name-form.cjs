const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const swc = require('next/dist/build/swc');

(async () => {
  const identity = await import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync('app/utils/athleteIdentity.js', 'utf8')).toString('base64')}`);
  assert.equal(identity.getAthleteName({ username: 'nickname', fullName: 'Nickname' }), '');
  assert.equal(identity.getAthleteName({ firstName: 'Anna', lastName: '  ' }), '');
  assert.equal(identity.getAthleteName({ firstName: ' Anna Maria ', lastName: ' D’Èlia ' }), 'Anna Maria D’Èlia');

  await swc.loadBindings();
  const transformed = await swc.transform(fs.readFileSync('app/components/AthleteNameForm.js', 'utf8'), {
    filename: 'athlete-name-form.js', jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
  });
  let state = [], cursor = 0, writes = [], finish;
  const user = { firstName: '', lastName: '', username: 'unchanged', update: async (value) => { writes.push(value); return new Promise((resolve) => { finish = () => resolve(value); }); } };
  const compiled = { exports: {} };
  vm.runInNewContext(transformed.code, {
    module: compiled, exports: compiled.exports,
    require: (id) => {
      if (id === '@/app/utils/athleteIdentity') return identity;
      if (id === '@clerk/nextjs') return { useUser: () => ({ user }) };
      if (id === 'react') return { ...React, useState(initial) {
        const i = cursor++;
        if (!(i in state)) state[i] = initial;
        return [state[i], (v) => { state[i] = v; }];
      } };
      return require(id);
    },
  });
  const find = (node, type) => {
    if (!node || typeof node !== 'object') return null;
    if (node.type === type) return node;
    return React.Children.toArray(node.props?.children).map((child) => find(child, type)).find(Boolean);
  };
  const render = () => { cursor = 0; return compiled.exports.default(); };
  const submit = () => find(render(), 'form').props.onSubmit({ preventDefault() {} });
  await submit(); assert.equal(writes.length, 0);
  state[0] = 'Anna'; state[1] = '\t';
  await submit(); assert.equal(writes.length, 0);
  state[0] = ' Anna Maria '; state[1] = ' D’Èlia ';
  const pending = submit();
  assert.equal(find(render(), 'button').props.disabled, true);
  await submit(); assert.equal(writes.length, 1, 'No duplicate request while saving');
  finish(); await pending;
  assert.equal(writes[0].firstName, 'Anna Maria'); assert.equal(writes[0].lastName, 'D’Èlia');
  assert.equal(Object.hasOwn(writes[0], 'username'), false, 'Login username must remain unchanged');
  user.update = async () => { throw new Error('Connessione assente'); };
  await submit();
  assert.equal(state[3], 'Connessione assente'); assert.equal(state[2], false);
  assert.equal(state[0], ' Anna Maria ', 'Failed save must preserve typed names');
  console.log('Athlete names: complete identity, whitespace, compound names, save, duplicate submission and errors passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
