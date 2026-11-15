import { CommonModule, DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartData, ChartOptions } from 'chart.js';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ConfirmService } from '../../services/confirm.service';
import { Exam, ExamApiService, ExamHistory, ExamSection } from '../../services/exam-api.service';

@Component({
  selector: 'app-exams-page',
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './exams-page.component.html',
  styleUrl: './exams-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExamsPageComponent {
  private readonly api = inject(ExamApiService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirm = inject(ConfirmService);
  protected readonly auth = inject(AuthService);
  protected readonly sections = signal<ExamSection[]>([]);
  protected readonly history = signal<ExamHistory[]>([]);
  protected readonly exam = signal<Exam | null>(null);
  protected readonly index = signal(0);
  protected readonly section = signal('mixed');
  protected readonly minutes = signal(10);
  protected readonly busy = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly showHistory = signal(false);
  protected readonly now = signal(Date.now());
  protected readonly current = computed(() => this.exam()?.questions[this.index()]);
  protected readonly remaining = computed(() => Math.max(0, Math.ceil(((this.exam()?.deadlineAt ?? this.now()) - this.now()) / 1000)));
  protected readonly answeredCount = computed(() => {
    const exam = this.exam();
    return exam ? exam.questions.filter((question) => !!exam.answers?.[question.id]).length : 0;
  });
  protected readonly unansweredCount = computed(() => (this.exam()?.questions.length ?? 0) - this.answeredCount());
  protected readonly stats = computed(() => {
    const records = this.history();
    const count = records.length;
    const total = records.reduce((sum, record) => sum + record.correct + record.incorrect + record.unanswered, 0);
    return {
      count,
      percent: total ? Math.round(records.reduce((sum, record) => sum + record.correct, 0) * 100 / total) : 0,
      errors: count ? records.reduce((sum, record) => sum + record.incorrect, 0) / count : 0,
      minutes: count ? records.reduce((sum, record) => sum + record.durationSeconds, 0) / count / 60 : 0
    };
  });
  protected readonly timeChart = computed<ChartData<'line'>>(() => {
    const records = [...this.history()].slice(0, 20).reverse();
    return { labels: records.map((_, i) => `${i + 1}`), datasets: [{
      label: 'Minutos', data: records.map((record) => record.durationSeconds / 60),
      borderColor: '#23345a', backgroundColor: 'rgba(142,223,192,.3)', fill: true, tension: 0.3
    }] };
  });
  protected readonly resultChart = computed<ChartData<'doughnut'>>(() => ({
    labels: ['Aciertos', 'Errores', 'Sin responder'],
    datasets: [{
      data: [
        this.history().reduce((sum, record) => sum + record.correct, 0),
        this.history().reduce((sum, record) => sum + record.incorrect, 0),
        this.history().reduce((sum, record) => sum + record.unanswered, 0)
      ],
      backgroundColor: ['#4ea07d', '#d7685f', '#e1b848']
    }]
  }));
  protected readonly scoreChart = computed<ChartData<'line'>>(() => {
    const records = [...this.history()].slice(0, 20).reverse();
    return {
      labels: records.map((record) => new Date(record.startedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })),
      datasets: [{
        label: 'Aciertos (%)',
        data: records.map((record) => {
          const total = record.correct + record.incorrect + record.unanswered;
          return total ? Math.round(record.correct * 100 / total) : 0;
        }),
        borderColor: '#4ea07d', backgroundColor: 'rgba(142,223,192,.3)', fill: true, tension: 0.3
      }]
    };
  });
  protected readonly chartOptions: ChartOptions<'line'> = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };
  protected readonly scoreChartOptions: ChartOptions<'line'> = {
    responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
    scales: { y: { min: 0, max: 100, ticks: { callback: (value) => `${value}%` } } }
  };
  protected readonly doughnutOptions: ChartOptions<'doughnut'> = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };

  constructor() {
    void this.load();
    const timer = setInterval(() => {
      this.now.set(Date.now());
      if (this.exam()?.status === 'active' && this.remaining() === 0 && !this.busy() && !this.error()) void this.finish();
    }, 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  private storageKey(): string { return `exam-active-${this.auth.user()?.id ?? ''}`; }
  private saveActive(exam: Exam): void {
    const storage = this.document.defaultView?.sessionStorage;
    if (exam.status === 'active') storage?.setItem(this.storageKey(), exam.id);
    else storage?.removeItem(this.storageKey());
  }
  private message(error: unknown): string {
    return error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
      ? error.error.message : 'No se pudo completar la operación. Inténtalo de nuevo.';
  }
  private async load(): Promise<void> {
    try {
      const [sections, history] = await Promise.all([firstValueFrom(this.api.sections()), firstValueFrom(this.api.history())]);
      this.sections.set(sections);
      this.history.set(history);
      const activeId = this.document.defaultView?.sessionStorage.getItem(this.storageKey());
      if (activeId) {
        const exam = await firstValueFrom(this.api.exam(activeId));
        this.exam.set(exam);
        this.saveActive(exam);
        if (exam.status === 'finished') await this.refreshHistory();
      }
    } catch (error) { this.error.set(this.message(error)); }
    finally { this.loading.set(false); }
  }
  private async refreshHistory(): Promise<void> { this.history.set(await firstValueFrom(this.api.history())); }
  protected async start(): Promise<void> {
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try {
      const exam = await firstValueFrom(this.api.start(this.section(), this.minutes()));
      this.exam.set(exam); this.index.set(0); this.saveActive(exam); this.now.set(Date.now());
    } catch (error) { this.error.set(this.message(error)); }
    finally { this.busy.set(false); }
  }
  protected async answer(optionId: string): Promise<void> {
    const exam = this.exam(); const question = this.current();
    if (!exam || !question || exam.status !== 'active' || this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      const updated = await firstValueFrom(this.api.answer(exam.id, question.id, optionId));
      this.exam.set(updated); this.saveActive(updated);
      if (updated.status === 'finished') await this.refreshHistory();
    } catch (error) { this.error.set(this.message(error)); }
    finally { this.busy.set(false); }
  }
  protected async finish(): Promise<void> {
    const exam = this.exam();
    if (!exam || exam.status !== 'active' || this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      const result = await firstValueFrom(this.api.finish(exam.id));
      this.exam.set(result); this.saveActive(result); this.index.set(0);
      await this.refreshHistory();
    } catch (error) { this.error.set(this.message(error)); }
    finally { this.busy.set(false); }
  }
  protected async openResult(id: string): Promise<void> {
    if (this.exam()?.status === 'active') {
      this.error.set('Finaliza el examen actual antes de consultar otro resultado.');
      return;
    }
    this.busy.set(true); this.error.set('');
    try { this.exam.set(await firstValueFrom(this.api.exam(id))); this.index.set(0); }
    catch (error) { this.error.set(this.message(error)); }
    finally { this.busy.set(false); }
  }
  protected async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try {
      const result = await firstValueFrom(this.api.import(file));
      this.sections.set(await firstValueFrom(this.api.sections()));
      this.notice.set(`Importadas o actualizadas ${result.imported} preguntas.`);
    } catch (error) { this.error.set(this.message(error)); }
    finally { input.value = ''; this.busy.set(false); }
  }
  protected async importInitial(): Promise<void> {
    const accepted = await this.confirm.confirm({
      title: 'Cargar banco HAREC inicial',
      message: 'Se añadirán o actualizarán por ID las 60 preguntas iniciales. Las demás preguntas se conservarán.',
      confirmLabel: 'Cargar preguntas',
      cancelLabel: 'Cancelar'
    });
    if (!accepted) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try {
      const result = await firstValueFrom(this.api.importInitial());
      this.sections.set(await firstValueFrom(this.api.sections()));
      this.notice.set(`Importadas o actualizadas ${result.imported} preguntas.`);
    } catch (error) { this.error.set(this.message(error)); }
    finally { this.busy.set(false); }
  }
  protected clock(seconds: number): string {
    return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
}
