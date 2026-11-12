import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const mocks = {
  '@angular/core': `
    export const ChangeDetectionStrategy = { OnPush: 0 };
    export const Component = (metadata) => (target) => { target.metadata = metadata; return target; };
    export const inject = (token) => globalThis.boardTracingTest[token];
    export const input = { required: () => { let value; const read = () => value; read.set = (next) => value = next; return read; } };
    export const signal = (initial) => { let value = initial; const read = () => value; read.set = (next) => value = next; return read; };
    export const computed = (fn) => fn;
  `,
  '@angular/router': `export const RouterLink = {};`,
  auth: `export const AuthService = 'auth';`,
  tracing: `export const TaskTracingComponent = {};`
};
const compiled = await build({
  entryPoints: ['src/app/components/task-board-tracing.component.ts'], bundle: true, write: false,
  format: 'esm', platform: 'node', tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
  plugins: [{
    name: 'board-tracing-mocks',
    setup(plugin) {
      plugin.onResolve({ filter: /^(?:@angular\/core|@angular\/router)$/ },
        ({ path }) => ({ path, namespace: 'mock' }));
      plugin.onResolve({ filter: /auth\.service$/ }, () => ({ path: 'auth', namespace: 'mock' }));
      plugin.onResolve({ filter: /task-tracing\.component$/ }, () => ({ path: 'tracing', namespace: 'mock' }));
      plugin.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: mocks[path], loader: 'js' }));
    }
  }]
});
const source = compiled.outputFiles[0].text;
const { TaskBoardTracingComponent } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('board tracing selects existing tasks and clears the displayed selection when one disappears', () => {
  globalThis.boardTracingTest = { auth: { user: () => ({ permissions: ['tracing:app'] }) } };
  const component = new TaskBoardTracingComponent();
  component.tasks.set([{ id: 'one', title: 'Primera' }, { id: 'two', title: 'Segunda' }]);
  assert.equal(component.selectedTaskId(), '');
  component.select('one');
  assert.equal(component.selectedTaskId(), 'one');
  component.select('two');
  assert.equal(component.selectedTaskId(), 'two');
  component.tasks.set([{ id: 'one', title: 'Primera' }]);
  assert.equal(component.selectedTaskId(), '');
  component.select('');
  assert.equal(component.selectedTaskId(), '');
});

test('panel separates permissions and passes the selected module to the history component', () => {
  const template = TaskBoardTracingComponent.metadata.template;
  assert.match(template, /permissions\?\.includes\('monitoring:app'\)/);
  assert.match(template, /permissions\?\.includes\('tracing:app'\)/);
  assert.match(template, /routerLink="\/monitorizacion"/);
  assert.match(template, /<app-task-tracing \[module\]="module\(\)" \[taskId\]="taskId"/);
  assert.match(template, /según sus filtros y paginación/);
});

test('panel appears on the page rather than inside the task detail', async () => {
  const template = await readFile('src/app/pages/task-board/task-board-page.component.html', 'utf8');
  assert.match(template, /<\/header>\s*<app-task-board-tracing module="board" \[tasks\]="tasks\(\)"/);
  assert.doesNotMatch(template, /<app-task-tracing/);
  assert.match(template, /@for \(entry of task\.history/);
});

test('todo panel uses the visible loaded items and keeps activity and reminders in the detail', async () => {
  const template = await readFile('src/app/pages/todo-list/todo-list-page.component.html', 'utf8');
  assert.match(template, /<\/header>\s*<app-task-board-tracing module="todo" \[tasks\]="todoListItems\(\)"/);
  assert.doesNotMatch(template, /<app-task-tracing/);
  assert.match(template, /@for \(todoListActivity of todoListDetail\(\)\?\.activities/);
  assert.match(template, /class="todoList-detail-reminders"/);
});
