<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useTimerStore } from '@/stores/timer'
import TimerDisplay from '@/components/TimerDisplay.vue'
import TimerControls from '@/components/TimerControls.vue'

const s = useTimerStore()
const totalHours = ref(s.cfg.totalHours)
const workMin    = ref(s.cfg.workMin)
const restMin    = ref(s.cfg.restMin)
const snoozeMin  = ref(s.cfg.snoozeMin)

onMounted(() => {
  s.restore()
  totalHours.value = s.cfg.totalHours
  workMin.value = s.cfg.workMin
  restMin.value = s.cfg.restMin
  snoozeMin.value = s.cfg.snoozeMin
  s.ensurePermission()
})
watch([totalHours, workMin, restMin, snoozeMin], ([h, w, r, sn]) => {
  s.configure({ totalHours: h, workMin: w, restMin: r, snoozeMin: sn })
})
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
    <div class="w-full max-w-md space-y-6">
      <header class="text-center space-y-2">
        <h1 class="text-2xl font-bold">WorkRest Timer</h1>
      </header>

      <section class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="text-xs text-slate-400">Общее время (часы)</span>
          <input type="number" v-model.number="totalHours" min="1" class="w-full mt-1 rounded-xl bg-slate-800 px-3 py-2" />
        </label>
        <label class="block">
          <span class="text-xs text-slate-400">Работа (мин)</span>
          <input type="number" v-model.number="workMin" min="1" class="w-full mt-1 rounded-xl bg-slate-800 px-3 py-2" />
        </label>
        <label class="block">
          <span class="text-xs text-slate-400">Отдых (мин)</span>
          <input type="number" v-model.number="restMin" min="1" class="w-full mt-1 rounded-xl bg-slate-800 px-3 py-2" />
        </label>
        <label class="block">
          <span class="text-xs text-slate-400">Отложить (мин)</span>
          <input type="number" v-model.number="snoozeMin" min="1" class="w-full mt-1 rounded-xl bg-slate-800 px-3 py-2" />
        </label>
      </section>

      <TimerDisplay />
      <TimerControls />
    </div>
  </div>
</template>
