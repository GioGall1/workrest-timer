<script setup lang="ts">
import { computed } from 'vue'
import { useTimerStore } from '@/stores/timer'

const s = useTimerStore()

const label = computed(() =>
  s.phase === 'work' ? 'Работа'
  : s.phase === 'rest' ? 'Отдых'
  : s.phase === 'done' ? 'Готово'
  : 'Ожидание'
)

const mm = computed(() => String(Math.floor(s.remainingMs / 1000 / 60)).padStart(2,'0'))
const ss = computed(() => String(Math.floor((s.remainingMs / 1000) % 60)).padStart(2,'0'))
const cs = computed(() => String(Math.floor((s.remainingMs % 1000) / 10)).padStart(2, '0'))
const progressPct = computed(() => (s.phaseProgress * 100).toFixed(1) + '%')
</script>

<template>
  <div class="space-y-3">
    <div class="bg-slate-900 rounded-2xl p-5 flex items-center justify-between">
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-400">Фаза</p>
        <p class="text-xl font-semibold">{{ label }}</p>
      </div>
      <div class="text-right">
        <p class="text-xs uppercase tracking-wide text-slate-400">Осталось</p>
        <p class="text-2xl font-bold tabular-nums">
          {{ mm }}:{{ ss }}<span class="text-sm opacity-70">.{{ cs }}</span>
        </p>
      </div>
    </div>

    <!-- прогресс текущей фазы -->
    <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
      <div class="h-full bg-emerald-500" :style="{ width: progressPct }"></div>
    </div>
  </div>
</template>