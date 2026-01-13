<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Mobile menu button -->
    <div class="lg:hidden">
      <button
        @click="mobileMenuOpen = !mobileMenuOpen"
        class="fixed top-4 left-4 z-50 p-2 rounded-md bg-white dark:bg-gray-800 shadow-lg"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
            :d="mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'" />
        </svg>
      </button>
    </div>
    
    <!-- Sidebar -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-40 bg-white dark:bg-gray-800 shadow-lg transform transition-all duration-300 lg:translate-x-0',
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        sidebarCollapsed ? 'lg:w-16 w-64' : 'w-64'
      ]"
    >
      <div class="flex items-center h-16 bg-primary-600 transition-all duration-300"
        :class="sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-4'"
      >
        <h1 v-if="!sidebarCollapsed" class="text-xl font-bold text-white truncate">BI Forecast</h1>
        <h1 v-else class="text-xl font-bold text-white">BI</h1>
        
        <button 
          @click="sidebarCollapsed = !sidebarCollapsed" 
          class="text-white hover:bg-primary-700 rounded p-1 hidden lg:block focus:outline-none"
          :title="sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
        >
          <svg v-if="!sidebarCollapsed" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      
      <nav class="mt-8 flex flex-col gap-2">
        <RouterLink
          to="/"
          class="flex items-center py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300"
          :class="[
            $route.name === 'Dashboard' ? 'bg-gray-100 dark:bg-gray-700 border-l-4 border-primary-600' : 'border-l-4 border-transparent',
            sidebarCollapsed ? 'justify-center px-2' : 'px-6'
          ]"
          :title="sidebarCollapsed ? 'Dashboard' : ''"
        >
          <svg class="w-5 h-5" :class="!sidebarCollapsed ? 'mr-3' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span v-if="!sidebarCollapsed" class="truncate">Dashboard</span>
        </RouterLink>
        
        <RouterLink
          to="/exceptions"
          class="flex items-center py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300"
          :class="[
            $route.name === 'Exceptions' ? 'bg-gray-100 dark:bg-gray-700 border-l-4 border-primary-600' : 'border-l-4 border-transparent',
            sidebarCollapsed ? 'justify-center px-2' : 'px-6'
          ]"
          :title="sidebarCollapsed ? 'Exceptions' : ''"
        >
          <svg class="w-5 h-5" :class="!sidebarCollapsed ? 'mr-3' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span v-if="!sidebarCollapsed" class="truncate">Exceptions</span>
        </RouterLink>
        
        <RouterLink
          to="/balances"
          class="flex items-center py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300"
          :class="[
            $route.name === 'Balances' ? 'bg-gray-100 dark:bg-gray-700 border-l-4 border-primary-600' : 'border-l-4 border-transparent',
            sidebarCollapsed ? 'justify-center px-2' : 'px-6'
          ]"
          :title="sidebarCollapsed ? 'Balances' : ''"
        >
          <svg class="w-5 h-5" :class="!sidebarCollapsed ? 'mr-3' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span v-if="!sidebarCollapsed" class="truncate">Balances</span>
        </RouterLink>
        
        <RouterLink
          to="/accounts-receivable"
          class="flex items-center py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300"
          :class="[
            $route.name === 'AccountsReceivable' ? 'bg-gray-100 dark:bg-gray-700 border-l-4 border-primary-600' : 'border-l-4 border-transparent',
            sidebarCollapsed ? 'justify-center px-2' : 'px-6'
          ]"
          :title="sidebarCollapsed ? 'Accounts Receivable' : ''"
        >
          <svg class="w-5 h-5" :class="!sidebarCollapsed ? 'mr-3' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
          </svg>
          <span v-if="!sidebarCollapsed" class="truncate">A/R</span>
        </RouterLink>

        <RouterLink
          to="/journal-entries"
          class="flex items-center py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300"
          :class="[
            $route.name === 'JournalEntries' ? 'bg-gray-100 dark:bg-gray-700 border-l-4 border-primary-600' : 'border-l-4 border-transparent',
            sidebarCollapsed ? 'justify-center px-2' : 'px-6'
          ]"
          :title="sidebarCollapsed ? 'Journal Entries' : ''"
        >
          <svg class="w-5 h-5" :class="!sidebarCollapsed ? 'mr-3' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M7 8h3m5 0h3M7 12h10M7 16h10" />
          </svg>
          <span v-if="!sidebarCollapsed" class="truncate">Journal Entries</span>
        </RouterLink>

        <RouterLink
          to="/users"
          v-if="user?.role === 'admin'"
          class="flex items-center py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300"
          :class="[
            $route.name === 'Users' ? 'bg-gray-100 dark:bg-gray-700 border-l-4 border-primary-600' : 'border-l-4 border-transparent',
            sidebarCollapsed ? 'justify-center px-2' : 'px-6'
          ]"
          :title="sidebarCollapsed ? 'Users' : ''"
        >
          <svg class="w-5 h-5" :class="!sidebarCollapsed ? 'mr-3' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M13 7a4 4 0 11-8 0 4 4 0 018 0zM23 21v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75" />
          </svg>
          <span v-if="!sidebarCollapsed" class="truncate">Users</span>
        </RouterLink>
        
        <RouterLink
          to="/settings"
          class="flex items-center py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300"
          :class="[
            $route.name === 'Settings' ? 'bg-gray-100 dark:bg-gray-700 border-l-4 border-primary-600' : 'border-l-4 border-transparent',
            sidebarCollapsed ? 'justify-center px-2' : 'px-6'
          ]"
          :title="sidebarCollapsed ? 'Settings' : ''"
        >
          <svg class="w-5 h-5" :class="!sidebarCollapsed ? 'mr-3' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span v-if="!sidebarCollapsed" class="truncate">Settings</span>
        </RouterLink>
      </nav>
      
      <!-- User info -->
      <div class="absolute bottom-0 w-full p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-300"
        :class="sidebarCollapsed ? 'px-2' : ''"
      >
        <div class="flex items-center" :class="sidebarCollapsed ? 'justify-center' : ''">
          <img 
            v-if="user?.picture" 
            :src="user.picture" 
            :alt="user.name"
            class="w-10 h-10 rounded-full flex-shrink-0"
            :class="!sidebarCollapsed ? 'mr-3' : ''"
            referrerpolicy="no-referrer"
            :title="sidebarCollapsed ? user?.name : ''"
          />
          <div 
            v-else 
            class="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center"
            :class="!sidebarCollapsed ? 'mr-3' : ''"
          >
            <svg class="w-6 h-6 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div v-if="!sidebarCollapsed" class="flex-1 min-w-0 transition-opacity duration-300">
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ user?.name || 'User' }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate" :title="user?.email">{{ user?.email || 'email@example.com' }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ company?.name || 'Company' }}</p>
            <p v-if="user?.role" class="text-xs text-blue-600 dark:text-blue-400 capitalize">{{ user.role }}</p>
          </div>
          <button v-if="!sidebarCollapsed" @click="logout" class="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" title="Logout">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
    
    <!-- Main content -->
    <main 
      class="transition-all duration-300"
      :class="sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'"
    >
      <div class="p-4 lg:p-8">
        <slot />
      </div>
    </main>
    
    <!-- Mobile overlay -->
    <div
      v-if="mobileMenuOpen"
      @click="mobileMenuOpen = false"
      class="fixed inset-0 bg-black opacity-50 z-30 lg:hidden"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const mobileMenuOpen = ref(false)
const sidebarCollapsed = ref(false)

const user = computed(() => authStore.user)
const company = computed(() => authStore.company)

function logout() {
  authStore.logout()
  router.push('/login')
}
</script>