<script setup lang="ts">
import { computed } from 'vue'
import { useTimerStore } from '@/stores/timer'
// Tabler Icons (предполагается, что установлен @tabler/icons-vue)
import {
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconAlarmSnooze,
  IconPlayerTrackNextFilled,
  IconRefresh,
  IconCoffee,
  IconBriefcase
} from '@tabler/icons-vue'

const s = useTimerStore()

// показывать кнопку "Отложить" только когда ждём действие
const showSnooze = computed(() => s.awaitingAction)

// Какая сейчас роль у главной кнопки
const mainKind = computed<'start' | 'pause' | 'continue' | 'awaiting'>(() => {
  if (s.awaitingAction) return 'awaiting'      // ждём действие по окончании фазы
  if (s.isPaused)       return 'continue'      // стоим на паузе
  if (s.isRunning)      return 'pause'         // идёт work/rest
  return 'start'                                  // ещё не запускали
})

// Главная левая кнопка: текст и поведение
const mainLabel = computed(() => {
    if (mainKind.value === 'pause') return 'Пауза'
    if (mainKind.value === 'continue') return 'Продолжить'
    if (mainKind.value === 'awaiting') {
      // только что была эта фаза => дальше идём в противоположную
      return s.phase === 'work' ? 'Отдыхать' : 'Работать'
    }
  return 'Старт'
})

const onMainClick = () => {
  switch (mainKind.value) {
    case 'pause':
      s.pause()
      break
    case 'continue':
    case 'start':
      s.start() // стартуем/продолжаем
      break
    case 'awaiting':
      s.completePhase() // корректно переходим к следующей фазе цикла
      break
  }
}

const mainColorClass = computed(() =>
  mainKind.value === 'pause' ? 'bg-amber-600' : 'bg-emerald-600'
)

// Пропустить/Продолжить фазу
const skipLabel = computed(() => (s.awaitingAction ? 'Продолжить фазу' : 'Пропустить фазу'))
const onSkip = () => (s.awaitingAction ? s.completePhase() : s.skip())
</script>

<template>
  <!-- общий вертикальный контейнер, который управляет расстоянием между рядами -->
  <div class="flex flex-col space-y-2">
    <!-- Ряд: Старт / Пауза -->
    <div class="flex gap-2">
      <!-- Старт (динамически растягивается, если «Пауза» скрыта) -->
      <!-- Главная кнопка: Старт / Пауза / Продолжить -->
    <button
      :class="[
        'w-full rounded-2xl px-6 py-3 font-semibold active:scale-95 transition inline-flex items-center justify-center gap-2 transition-all duration-300',
        mainColorClass
      ]"
      @click="onMainClick"
    >
      <IconPlayerPauseFilled v-if="mainKind === 'pause'" class="w-5 h-5" />
      <IconPlayerPlayFilled  v-else-if="mainKind === 'continue' || mainKind === 'start'" class="w-5 h-5" />
      <IconCoffee             v-else-if="mainKind === 'awaiting' && s.phase === 'work'" class="w-5 h-5" />
      <IconBriefcase          v-else class="w-5 h-5" />
      {{ mainLabel }}
    </button>
    </div>
    <!-- Ряд с Отложить / Пропустить -->
    <div class="flex gap-2">
      <!-- Отложить: появляется только на завершении фазы -->
      <transition name="fade">
        <button
          v-if="showSnooze"
          class="flex-1 rounded-2xl px-6 py-3 font-semibold bg-indigo-600 active:scale-95 transition-all duration-300 inline-flex items-center justify-center gap-2"
          @click="s.snooze"
        >
          <IconAlarmSnooze class="w-5 h-5" />
          Отложить
        </button>
      </transition>

      <!-- Пропустить/Продолжить: ширина меняется плавно -->
      <button
        :class="[
          showSnooze ? 'flex-1' : 'w-full',
          'rounded-2xl px-6 py-3 font-semibold bg-slate-600 active:scale-95 transition-all duration-300 inline-flex items-center justify-center gap-2'
        ]"
        @click="onSkip"
      >
        <IconPlayerTrackNextFilled class="w-5 h-5" />
        {{ skipLabel }}
      </button>
    </div>

    <button
      class="w-full rounded-2xl px-6 py-3 font-semibold bg-rose-600 active:scale-95 transition inline-flex items-center justify-center gap-2"
      @click="s.reset"
    >
      <IconRefresh class="w-5 h-5" />
      Сброс
    </button>
  </div>
</template>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity .2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>