/**
 * Trace Debugger
 * Утилита для отладки и анализа trace событий от tool execute flow
 * Обеспечивает удобные методы для экспорта, фильтрации и визуализации трассировки
 */

import { TraceLogger, TraceEvent, TraceLevel } from './TraceLogger';

export interface TraceAnalysis {
  totalEvents: number;
  eventsByLevel: Record<TraceLevel, number>;
  phases: PhaseSummary[];
  errors: TraceEvent[];
  timeline: TimelineEntry[];
}

export interface PhaseSummary {
  name: string;
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
}

export interface TimelineEntry {
  timestamp: string;
  level: TraceLevel;
  message: string;
  duration?: number;
}

export class TraceDebugger {
  constructor(private traceLogger: TraceLogger) {}

  /**
   * Анализ всех событий трассировки
   */
  analyzeTraces(): TraceAnalysis {
    const traces = this.traceLogger.getTraces();

    // Подсчёт событий по уровню
    const eventsByLevel: Record<TraceLevel, number> = {
      [TraceLevel.TRACE]: 0,
      [TraceLevel.DEBUG]: 0,
      [TraceLevel.INFO]: 0,
      [TraceLevel.WARN]: 0,
      [TraceLevel.ERROR]: 0
    };

    for (const trace of traces) {
      eventsByLevel[trace.level]++;
    }

    // Анализ фаз
    const phases = this.analyzePhaseDurations(traces);

    // Выделение ошибок
    const errors = traces.filter(t => t.level === TraceLevel.ERROR);

    // Временная шкала
    const timeline = traces.map(t => ({
      timestamp: t.timestamp,
      level: t.level,
      message: t.message,
      duration: t.context?.duration_ms
    }));

    return {
      totalEvents: traces.length,
      eventsByLevel,
      phases,
      errors,
      timeline
    };
  }

  /**
   * Анализ длительности фаз
   */
  private analyzePhaseDurations(traces: TraceEvent[]): PhaseSummary[] {
    const phaseDurations: Record<string, number[]> = {};

    for (const trace of traces) {
      if (trace.message.includes('PHASE END') && trace.context?.duration_ms) {
        const phaseName = trace.context.phase || 'UNKNOWN';
        if (!phaseDurations[phaseName]) {
          phaseDurations[phaseName] = [];
        }
        phaseDurations[phaseName].push(trace.context.duration_ms);
      }
    }

    return Object.entries(phaseDurations).map(([name, durations]) => ({
      name,
      count: durations.length,
      totalDuration: durations.reduce((a, b) => a + b, 0),
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations)
    }));
  }

  /**
   * Фильтрация событий по критериям
   */
  filterTraces(criteria: {
    level?: TraceLevel;
    phase?: string;
    toolId?: string;
    message?: RegExp;
  }): TraceEvent[] {
    const traces = this.traceLogger.getTraces();

    return traces.filter(trace => {
      if (criteria.level && trace.level !== criteria.level) {
        return false;
      }
      if (criteria.phase && trace.context?.phase !== criteria.phase) {
        return false;
      }
      if (criteria.toolId && trace.context?.tool_id !== criteria.toolId) {
        return false;
      }
      if (criteria.message && !criteria.message.test(trace.message)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Получить визуальный отчёт в формате ASCII
   */
  generateASCIIReport(toolId?: string): string {
    const lines: string[] = [];
    lines.push('═'.repeat(80));
    lines.push(`TRACE DEBUGGER REPORT${toolId ? ` (Tool: ${toolId})` : ''}`);
    lines.push('═'.repeat(80));
    lines.push('');

    // Общая статистика
    const analysis = this.analyzeTraces();
    lines.push('📊 СТАТИСТИКА');
    lines.push('─'.repeat(80));
    lines.push(`Total Events: ${analysis.totalEvents}`);
    lines.push(`Trace:  ${analysis.eventsByLevel.TRACE}`);
    lines.push(`Debug:  ${analysis.eventsByLevel.DEBUG}`);
    lines.push(`Info:   ${analysis.eventsByLevel.INFO}`);
    lines.push(`Warn:   ${analysis.eventsByLevel.WARN}`);
    lines.push(`Error:  ${analysis.eventsByLevel.ERROR}`);
    lines.push('');

    // Фазы
    if (analysis.phases.length > 0) {
      lines.push('⏱️  ФАЗЫ');
      lines.push('─'.repeat(80));
      for (const phase of analysis.phases) {
        lines.push(
          `${phase.name.padEnd(20)} | Count: ${phase.count.toString().padEnd(3)} | ` +
          `Avg: ${phase.averageDuration.toFixed(0)}ms | Min: ${phase.minDuration}ms | Max: ${phase.maxDuration}ms`
        );
      }
      lines.push('');
    }

    // Ошибки
    if (analysis.errors.length > 0) {
      lines.push('❌ ОШИБКИ');
      lines.push('─'.repeat(80));
      for (const error of analysis.errors) {
        lines.push(`[${error.timestamp}] ${error.message}`);
        if (error.context) {
          lines.push(`  Context: ${JSON.stringify(error.context)}`);
        }
        if (error.stack) {
          lines.push(`  Stack: ${error.stack}`);
        }
      }
      lines.push('');
    }

    // Временная шкала
    lines.push('📈 ВРЕМЕННАЯ ШКАЛА');
    lines.push('─'.repeat(80));
    for (const entry of analysis.timeline.slice(-20)) {
      // Последние 20 событий
      const levelIcon = this.getLevelIcon(entry.level);
      const duration = entry.duration ? ` (${entry.duration}ms)` : '';
      lines.push(`${entry.timestamp} ${levelIcon} ${entry.message}${duration}`);
    }
    lines.push('');

    lines.push('═'.repeat(80));
    return lines.join('\n');
  }

  /**
   * Экспортировать детальный JSON отчёт
   */
  exportDetailedJSON(toolId?: string): string {
    const traces = toolId ? this.traceLogger.getToolTraces(toolId) : this.traceLogger.getTraces();
    const analysis = this.analyzeTraces();

    return JSON.stringify(
      {
        metadata: {
          exportedAt: new Date().toISOString(),
          toolId: toolId || 'all',
          totalEvents: traces.length
        },
        analysis,
        traces,
        recommendations: this.generateRecommendations(analysis)
      },
      null,
      2
    );
  }

  /**
   * Генерировать рекомендации на основе анализа
   */
  generateRecommendations(analysis: TraceAnalysis): string[] {
    const recommendations: string[] = [];

    // Проверка ошибок
    if (analysis.errors.length > 0) {
      recommendations.push(
        `⚠️  Найдено ${analysis.errors.length} ошибок. Проверьте логи выше.`
      );
    }

    // Проверка производительности
    const slowPhases = analysis.phases.filter(p => p.averageDuration > 5000);
    if (slowPhases.length > 0) {
      recommendations.push(
        `⏱️  Найдены медленные фазы (>5s): ${slowPhases.map(p => p.name).join(', ')}`
      );
    }

    // Проверка предупреждений
    if (analysis.eventsByLevel.WARN > 0) {
      recommendations.push(
        `⚠️  Найдено ${analysis.eventsByLevel.WARN} предупреждений.`
      );
    }

    // Успешное выполнение
    if (analysis.errors.length === 0 && analysis.eventsByLevel.WARN === 0) {
      recommendations.push('✅ Выполнение успешно без ошибок и предупреждений.');
    }

    return recommendations;
  }

  /**
   * Получить временную последовательность событий для инструмента
   */
  getEventTimeline(toolId: string): TimelineEntry[] {
    const traces = this.traceLogger.getToolTraces(toolId);
    return traces.map(t => ({
      timestamp: t.timestamp,
      level: t.level,
      message: t.message,
      duration: t.context?.duration_ms
    }));
  }

  /**
   * Сравнить выполнение двух инструментов
   */
  compareTools(toolId1: string, toolId2: string): string {
    const traces1 = this.traceLogger.getToolTraces(toolId1);
    const traces2 = this.traceLogger.getToolTraces(toolId2);

    const duration1 = this.calculateTotalDuration(traces1);
    const duration2 = this.calculateTotalDuration(traces2);

    const errors1 = traces1.filter(t => t.level === TraceLevel.ERROR).length;
    const errors2 = traces2.filter(t => t.level === TraceLevel.ERROR).length;

    const lines: string[] = [];
    lines.push('СРАВНЕНИЕ ИНСТРУМЕНТОВ');
    lines.push('─'.repeat(60));
    lines.push(`Tool 1 (${toolId1})`);
    lines.push(`  Events: ${traces1.length}`);
    lines.push(`  Duration: ${duration1}ms`);
    lines.push(`  Errors: ${errors1}`);
    lines.push('');
    lines.push(`Tool 2 (${toolId2})`);
    lines.push(`  Events: ${traces2.length}`);
    lines.push(`  Duration: ${duration2}ms`);
    lines.push(`  Errors: ${errors2}`);
    lines.push('');
    lines.push('РАЗНИЦА');
    lines.push(`  Events: ${traces1.length - traces2.length}`);
    lines.push(`  Duration: ${duration1 - duration2}ms (${((duration1 / duration2) * 100 - 100).toFixed(1)}%)`);
    lines.push(`  Errors: ${errors1 - errors2}`);

    return lines.join('\n');
  }

  /**
   * Проверить здоровье выполнения инструмента
   */
  getToolHealth(toolId: string): {
    healthy: boolean;
    score: number;
    issues: string[];
  } {
    const traces = this.traceLogger.getToolTraces(toolId);
    const errors = traces.filter(t => t.level === TraceLevel.ERROR);
    const warnings = traces.filter(t => t.level === TraceLevel.WARN);
    const duration = this.calculateTotalDuration(traces);

    let score = 100;
    const issues: string[] = [];

    if (errors.length > 0) {
      score -= errors.length * 20;
      issues.push(`${errors.length} ошибок`);
    }

    if (warnings.length > 0) {
      score -= warnings.length * 5;
      issues.push(`${warnings.length} предупреждений`);
    }

    if (duration > 30000) {
      // >30s
      score -= 10;
      issues.push(`Долгое выполнение (${duration}ms)`);
    }

    if (traces.length === 0) {
      score = 0;
      issues.push('Нет событий трассировки');
    }

    return {
      healthy: score >= 80,
      score: Math.max(0, score),
      issues
    };
  }

  /**
   * Утилита для получения иконки уровня
   */
  private getLevelIcon(level: TraceLevel): string {
    switch (level) {
      case TraceLevel.TRACE:
        return '🔍';
      case TraceLevel.DEBUG:
        return '🐛';
      case TraceLevel.INFO:
        return 'ℹ️';
      case TraceLevel.WARN:
        return '⚠️';
      case TraceLevel.ERROR:
        return '❌';
    }
  }

  /**
   * Вычислить общую продолжительность выполнения
   */
  private calculateTotalDuration(traces: TraceEvent[]): number {
    const phaseDurations = traces
      .filter(t => t.message.includes('PHASE END') && t.context?.duration_ms)
      .map(t => t.context?.duration_ms || 0);

    return phaseDurations.length > 0 ? Math.max(...phaseDurations) : 0;
  }
}

/**
 * Создать TraceDebugger для ToolHandler
 */
export const createTraceDebugger = (traceLogger: TraceLogger): TraceDebugger => {
  return new TraceDebugger(traceLogger);
};