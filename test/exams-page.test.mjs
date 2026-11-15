import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const mocks = {
  '@angular/core': `
    export const DestroyRef = 'destroy';
    export const ChangeDetectionStrategy = { OnPush: 0 };
    export const Component = () => (target) => target;
    export const inject = (token) => globalThis.examTest[token];
    export const signal = (initial) => {
      let value = initial;
      const read = () => value;
      read.set = (next) => { value = next; };
      return read;
    };
    export const computed = (callback) => callback;
  `,
  '@angular/common': `export const CommonModule = {}; export const DOCUMENT = 'document';`,
  '@angular/common/http': `export class HttpErrorResponse extends Error {}`,
  '@angular/forms': `export const FormsModule = {};`,
  'ng2-charts': `export const BaseChartDirective = {};`,
  rxjs: `export const firstValueFrom = (value) => value;`,
  'auth-service': `export const AuthService = 'auth';`,
  'exam-api': `export const ExamApiService = 'api';`,
  'confirm-service': `export const ConfirmService = 'confirm';`
};
const compiled = await build({
  entryPoints: ['src/app/pages/exams/exams-page.component.ts'],
  bundle: true, write: false, format: 'esm', platform: 'node',
  tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
  plugins: [{
    name: 'exam-mocks',
    setup(plugin) {
      plugin.onResolve({ filter: /^(?:@angular\/core|@angular\/common|@angular\/common\/http|@angular\/forms|ng2-charts|rxjs)$/ },
        ({ path }) => ({ path, namespace: 'mock' }));
      plugin.onResolve({ filter: /auth\.service$/ }, () => ({ path: 'auth-service', namespace: 'mock' }));
      plugin.onResolve({ filter: /exam-api\.service$/ }, () => ({ path: 'exam-api', namespace: 'mock' }));
      plugin.onResolve({ filter: /confirm\.service$/ }, () => ({ path: 'confirm-service', namespace: 'mock' }));
      plugin.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: mocks[path], loader: 'js' }));
    }
  }]
});
const source = compiled.outputFiles[0].text;
const { ExamsPageComponent } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function setup() {
  let cleanup;
  const storage = new Map();
  const exam = {
    id: 'one', status: 'active', section: 'mixed', minutes: 10, deadlineAt: Date.now() + 600000,
    questions: [{ id: 'q1', question: 'Pregunta', options: [{ id: 'a', text: 'A' }] }], answers: {}
  };
  const calls = [];
  globalThis.examTest = {
    destroy: { onDestroy: (callback) => { cleanup = callback; } },
    document: { defaultView: { sessionStorage: {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    } } },
    auth: { user: () => ({ id: 'alice', permissions: ['app:access'] }) },
    confirm: { confirm: async () => true },
    api: {
      sections: async () => [],
      history: async () => [],
      start: async (section, minutes) => { calls.push([section, minutes]); return exam; },
      answer: async (_id, question, option) => ({ ...exam, answers: { [question]: option } }),
      finish: async () => ({ ...exam, status: 'finished', correct: 1, incorrect: 0, unanswered: 0 }),
      exam: async () => exam
    }
  };
  const component = new ExamsPageComponent();
  return { component, calls, storage, cleanup: () => cleanup() };
}

test('starts, saves answers and finishes an exam while tracking its active ID', async () => {
  const { component, calls, storage, cleanup } = setup();
  try {
    await component.start();
    assert.deepEqual(calls, [['mixed', 10]]);
    assert.equal(storage.get('exam-active-alice'), 'one');
    await component.answer('a');
    assert.equal(component.exam().answers.q1, 'a');
    await component.finish();
    assert.equal(component.exam().status, 'finished');
    assert.equal(storage.has('exam-active-alice'), false);
  } finally { cleanup(); }
});

test('initial bank import uses the application confirmation and respects cancellation', async () => {
  const { component, cleanup } = setup();
  let confirmed = false;
  let imports = 0;
  let options;
  globalThis.examTest.confirm.confirm = async (value) => { options = value; return confirmed; };
  globalThis.examTest.api.importInitial = async () => { imports += 1; return { imported: 60 }; };
  try {
    await component.importInitial();
    assert.equal(imports, 0);
    assert.equal(options.title, 'Cargar banco HAREC inicial');
    assert.match(options.message, /actualizarán por ID/);
    confirmed = true;
    await component.importInitial();
    assert.equal(imports, 1);
    assert.match(component.notice(), /60 preguntas/);
  } finally { cleanup(); }
});

test('statistics account for correct, incorrect and unanswered questions', () => {
  const { component, cleanup } = setup();
  try {
    component.history.set([
      { correct: 7, incorrect: 2, unanswered: 1, durationSeconds: 300 },
      { correct: 9, incorrect: 1, unanswered: 0, durationSeconds: 420 }
    ]);
    assert.deepEqual(component.stats(), { count: 2, percent: 80, errors: 1.5, minutes: 6 });
    assert.equal(component.clock(64), '01:04');
  } finally { cleanup(); }
});
