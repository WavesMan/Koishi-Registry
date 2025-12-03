<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { format } from 'date-fns'

interface Package {
  name: string
  version: string
  description: string
  links?: {
    npm?: string
    homepage?: string
    repository?: string
  }
  maintainers?: { username: string; email?: string }[]
  keywords?: string[]
}

interface RegistryObject {
  category: string
  shortname: string
  package: Package
  score: {
    final: number
    detail: {
      quality: number
      popularity: number
      maintenance: number
    }
  }
  updatedAt: string
  rating?: number
}

interface RegistryData {
  time: string
  total: number
  objects: RegistryObject[]
}

const loading = ref(true)
const error = ref('')
const plugins = ref<RegistryObject[]>([])
const dataTime = ref('')
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = 12

function pad(n: number) { return String(n).padStart(2, '0') }
function formatUTC0(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}
function formatUTC8(d: Date) {
  const t = new Date(d.getTime() + 8 * 3600 * 1000)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}`
}
function timeAgo(ms: number) {
  const s = Math.floor(ms / 1000)
  if (s < 5) return '刚刚'
  if (s < 60) return `${s} 秒前`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} 天前`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo} 个月前`
  const y = Math.floor(mo / 12)
  return `${y} 年前`
}

const now = ref(new Date())
let timer: any

// Fetch data
onMounted(async () => {
  try {
    const response = await fetch('/index.json')
    if (!response.ok) throw new Error('Failed to fetch registry data')
    const data: RegistryData = await response.json()
    plugins.value = data.objects
    dataTime.value = data.time
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error'
    console.error(err)
  } finally {
    loading.value = false
  }
  timer = setInterval(() => { now.value = new Date() }, 30000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })

// Filtered plugins
const filteredPlugins = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) return plugins.value
  
  return plugins.value.filter(p => {
    const name = p.package.name.toLowerCase()
    const shortname = p.shortname?.toLowerCase() || ''
    const desc = p.package.description?.toLowerCase() || ''
    const keywords = p.package.keywords?.join(' ').toLowerCase() || ''
    
    return name.includes(query) || 
           shortname.includes(query) || 
           desc.includes(query) || 
           keywords.includes(query)
  })
})

// Pagination
const totalPages = computed(() => Math.ceil(filteredPlugins.value.length / pageSize))
const paginatedPlugins = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredPlugins.value.slice(start, start + pageSize)
})

function changePage(page: number) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function formatDate(dateStr: string) {
  try {
    return format(new Date(dateStr), 'yyyy-MM-dd')
  } catch {
    return dateStr
  }
}

const lastUpdated = computed(() => dataTime.value ? new Date(dataTime.value) : null)
const timeUTC0 = computed(() => lastUpdated.value ? formatUTC0(lastUpdated.value) : '')
const timeUTC8 = computed(() => lastUpdated.value ? formatUTC8(lastUpdated.value) : '')
const timeAgoText = computed(() => lastUpdated.value ? timeAgo(now.value.getTime() - lastUpdated.value.getTime()) : '')
const endpoint = computed(() => `${location.origin}/index.json`)
const copied = ref(false)
async function copyEndpoint() {
  try {
    await navigator.clipboard.writeText(endpoint.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {}
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Header -->
    <header class="border-b border-gray-700 bg-[#1a1a1a] sticky top-0 z-50">
      <div class="container mx-auto px-4 py-4 flex justify-between items-center">
        <div class="text-2xl font-bold text-blue-500 flex items-center gap-2">
          <i class="fas fa-cubes"></i>
          <span>Koishi Registry</span>
        </div>
        <nav>
          <ul class="flex gap-6 text-gray-300">
            <li><a href="#" class="hover:text-blue-500 transition-colors">首页</a></li>
            <li><a href="https://github.com/WavesMan/Koishi-Registry" target="_blank" class="hover:text-blue-500 transition-colors">GitHub</a></li>
            <li><a href="https://koishi.chat" target="_blank" class="hover:text-blue-500 transition-colors">Koishi文档</a></li>
          </ul>
        </nav>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-grow container mx-auto px-4 py-8">
      <!-- Hero / Search -->
      <div class="text-center mb-12">
        <h1 class="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
          发现 Koishi 插件
        </h1>
        <p class="text-xl text-gray-400 mb-8">
          探索 {{ plugins.length }} + 个插件，打造你的专属机器人
        </p>

        <div class="flex flex-wrap justify-center gap-3 mb-2">
          <div class="px-3 py-2 rounded bg-[#2d2d2d] border border-gray-700 text-sm text-gray-300">
            <span class="text-gray-500">UTC+0</span>
            <span class="ml-2 font-mono">{{ timeUTC0 }}</span>
          </div>
          <div class="px-3 py-2 rounded bg-[#2d2d2d] border border-gray-700 text-sm text-gray-300">
            <span class="text-gray-500">UTC+8</span>
            <span class="ml-2 font-mono">{{ timeUTC8 }}</span>
          </div>
          <div class="px-3 py-2 rounded bg-[#2d2d2d] border border-gray-700 text-sm text-gray-300">
            <span class="text-gray-500">距当前</span>
            <span class="ml-2">{{ timeAgoText }}</span>
          </div>
        </div>
        <div class="flex justify-center mb-6">
          <div class="px-3 py-2 rounded bg-[#2d2d2d] border border-gray-700 text-sm text-gray-300 ">
            <span class="text-gray-500">市场访问端点：</span>
            <div class="mt-1 flex items-center justify-center gap-2">
              <span class="font-mono break-all">{{ endpoint }}</span>
              <button @click="copyEndpoint" class="px-2 py-1 bg-gray-800 hover:bg-blue-600 rounded text-xs border border-gray-700 transition-colors flex items-center gap-1">
                <i class="fas fa-copy"></i>
                <span v-if="!copied">复制</span>
                <span v-else>已复制</span>
              </button>
            </div>
          </div>
        </div>
        
        <div class="max-w-2xl mx-auto relative">
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索插件名称、关键词或描述..." 
            class="w-full px-6 py-4 rounded-full bg-[#2d2d2d] border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-lg transition-all"
            @input="currentPage = 1"
          >
          <i class="fas fa-search absolute right-6 top-1/2 -translate-y-1/2 text-gray-500 text-xl"></i>
        </div>
      </div>

      <!-- Loading / Error -->
      <div v-if="loading" class="text-center py-12">
        <i class="fas fa-spinner fa-spin text-4xl text-blue-500"></i>
        <p class="mt-4 text-gray-400">正在加载数据...</p>
      </div>

      <div v-else-if="error" class="text-center py-12 text-red-500">
        <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
        <p>加载失败: {{ error }}</p>
      </div>

      <!-- List -->
      <div v-else>
        <div v-if="filteredPlugins.length === 0" class="text-center py-12 text-gray-500">
          <p>没有找到匹配的插件</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="plugin in paginatedPlugins" :key="plugin.package.name" 
               class="bg-[#2d2d2d] rounded-xl p-6 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 transition-all border border-transparent hover:border-gray-700 flex flex-col">
            <div class="flex justify-between items-start mb-4">
              <div class="flex-1 min-w-0">
                <h3 class="text-xl font-bold text-blue-400 truncate" :title="plugin.package.name">
                  {{ plugin.shortname || plugin.package.name }}
                </h3>
                <p class="text-xs text-gray-500 font-mono mt-1 truncate">{{ plugin.package.name }}</p>
              </div>
              <div class="bg-gray-800 text-xs px-2 py-1 rounded text-gray-400 whitespace-nowrap ml-2">
                v{{ plugin.package.version }}
              </div>
            </div>

            <p class="text-gray-300 text-sm mb-6 line-clamp-3 flex-grow">
              {{ plugin.package.description }}
            </p>

            <div class="flex flex-wrap gap-2 mb-4">
              <span v-for="kw in plugin.package.keywords?.slice(0, 3)" :key="kw" 
                    class="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
                {{ kw }}
              </span>
            </div>

            <div class="flex justify-between items-center pt-4 border-t border-gray-700 mt-auto text-sm text-gray-500">
              <div class="flex items-center gap-2" title="更新时间">
                <i class="far fa-clock"></i>
                <span>{{ formatDate(plugin.updatedAt) }}</span>
              </div>
              <div class="flex gap-3">
                <a v-if="plugin.package.links?.npm" :href="plugin.package.links.npm" target="_blank" 
                   class="hover:text-red-500 transition-colors" title="NPM">
                  <i class="fab fa-npm text-lg"></i>
                </a>
                <a v-if="plugin.package.links?.repository" :href="plugin.package.links.repository" target="_blank" 
                   class="hover:text-white transition-colors" title="GitHub">
                  <i class="fab fa-github text-lg"></i>
                </a>
                <a v-if="plugin.package.links?.homepage" :href="plugin.package.links.homepage" target="_blank" 
                   class="hover:text-blue-500 transition-colors" title="Homepage">
                  <i class="fas fa-globe text-lg"></i>
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex justify-center mt-12 gap-2">
          <button 
            @click="changePage(currentPage - 1)" 
            :disabled="currentPage === 1"
            class="px-4 py-2 rounded bg-[#2d2d2d] hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-[#2d2d2d] transition-colors"
          >
            上一页
          </button>
          
          <div class="flex items-center gap-1">
            <span class="px-4 py-2 bg-blue-600 rounded font-bold">{{ currentPage }}</span>
            <span class="text-gray-500 px-2">/</span>
            <span class="px-4 py-2 text-gray-400">{{ totalPages }}</span>
          </div>

          <button 
            @click="changePage(currentPage + 1)" 
            :disabled="currentPage === totalPages"
            class="px-4 py-2 rounded bg-[#2d2d2d] hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-[#2d2d2d] transition-colors"
          >
            下一页
          </button>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-gray-700 py-8 text-center text-gray-500">
      <p>&copy; {{ new Date().getFullYear() }} Koishi Registry. Powered by WaveYo.</p>
    </footer>
  </div>
</template>

<style scoped>
/* 这里的样式主要由 Tailwind 处理，补充一些滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: #1a1a1a; 
}
::-webkit-scrollbar-thumb {
  background: #374151; 
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #4b5563; 
}
</style>
