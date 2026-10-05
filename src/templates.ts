import type { SessionUser } from './auth';
import type { Event, StepEntry, Team, User } from './db';

function escapeHtml(str: string | number | null | undefined): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function statusBadge(status: Event['status']): string {
  const labels: Record<Event['status'], { text: string; classes: string }> = {
    accepting_participants: { text: 'Accepting participants', classes: 'bg-amber-100 text-amber-800 border-amber-200' },
    active: { text: 'Active', classes: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    closed: { text: 'Closed', classes: 'bg-slate-100 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700' },
  };
  const { text, classes } = labels[status];
  return `<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${classes}">${escapeHtml(text)}</span>`;
}

function layout(
  title: string,
  body: string,
  options: { user?: SessionUser; flash?: string; error?: string; success?: string } = {}
): string {
  const { user, flash, error, success } = options;
  const isAdmin = user?.role === 'admin';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] }
        }
      }
    }
  </script>
  <script>
    (function () {
      const root = document.documentElement;
      const stored = localStorage.getItem('theme');
      if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    })();
  </script>
</head>
<body class="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans dark:bg-slate-950 dark:text-slate-100">
  <div class="fixed inset-0 -z-10 block bg-cover bg-center bg-no-repeat dark:hidden" style="background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZlcnNpb249IjEuMSIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHhtbG5zOnN2Z2pzPSJodHRwOi8vc3ZnanMuZGV2L3N2Z2pzIiB3aWR0aD0iMTQ0MCIgaGVpZ2h0PSI1NjAiIHByZXNlcnZlQXNwZWN0UmF0aW89Im5vbmUiIHZpZXdCb3g9IjAgMCAxNDQwIDU2MCI+CiAgICA8ZyBtYXNrPSJ1cmwoJnF1b3Q7I1N2Z2pzTWFzazEwMDAmcXVvdDspIiBmaWxsPSJub25lIj4KICAgICAgICA8cmVjdCB3aWR0aD0iMTQ0MCIgaGVpZ2h0PSI1NjAiIHg9IjAiIHk9IjAiIGZpbGw9IiNmNGY3ZmUiPjwvcmVjdD4KICAgICAgICA8cGF0aCBkPSJNMTUzNiA1NjBMMCA1NjAgTDAgMzY1Ljk3UTIzLjU0IDI2OS41MSwgMTIwIDI5My4wNVExNjQuMSAyNjUuMTUsIDE5MiAzMDkuMjVRMjQzLjc4IDI4OS4wMywgMjY0IDM0MC44MVEzMDEuMzYgMjU4LjE3LCAzODQgMjk1LjUzUTQzNC44MiAyNzQuMzUsIDQ1NiAzMjUuMTdRNTM4LjkyIDI4OC4xLCA1NzYgMzcxLjAyUTYwNC4xNSAyNzkuMTcsIDY5NiAzMDcuMzNRNzc0LjMgMjY1LjYzLCA4MTYgMzQzLjk0UTg2Mi4yIDMxOC4xNCwgODg4IDM2NC4zNFE5MjkuMjkgMzMzLjYzLCA5NjAgMzc0LjkyUTk2NS43NiAzMDguNjksIDEwMzIgMzE0LjQ1UTEwODIuNTQgMjQ0Ljk5LCAxMTUyIDI5NS41MlExMjM5LjA1IDI2Mi41NywgMTI3MiAzNDkuNjJRMTMxOS43OCAzMjUuNCwgMTM0NCAzNzMuMTlRMTM2MS42NyAzMTguODYsIDE0MTYgMzM2LjUzUTE0ODIuNjkgMjgzLjIyLCAxNTM2IDM0OS45MXoiIGZpbGw9IiNlZWYzZmMiPjwvcGF0aD4KICAgICAgICA8cGF0aCBkPSJNMTQ4OCA1NjBMMCA1NjAgTDAgMzkxLjg4UTY0Ljc5IDMzNi42NywgMTIwIDQwMS40NlExOTIuMDYgMzUzLjUyLCAyNDAgNDI1LjU5UTI4My44OSAzOTcuNDgsIDMxMiA0NDEuMzdRMzQzLjE4IDM1Mi41NSwgNDMyIDM4My43M1E1MTUuMzggMzQ3LjExLCA1NTIgNDMwLjQ5UTYwMy4yIDM2MS42OSwgNjcyIDQxMi45UTcwMi44MyAzMjMuNzMsIDc5MiAzNTQuNTVRODcyLjE2IDMxNC43MiwgOTEyIDM5NC44OFE5NTYgMzY2Ljg4LCA5ODQgNDEwLjg5UTEwMzMuNjQgMzg4LjUzLCAxMDU2IDQzOC4xOFExMDc5LjE0IDM0MS4zMiwgMTE3NiAzNjQuNDZRMTIxOC42MyAzMzUuMDgsIDEyNDggMzc3LjcxUTEzMzAuMDIgMzM5LjczLCAxMzY4IDQyMS43NVExMzk2LjU2IDMzMC4zMSwgMTQ4OCAzNTguODZ6IiBmaWxsPSIjZGJlN2ZhIj48L3BhdGg+CiAgICAgICAgPHBhdGggZD0iTTE0NjQgNTYwTDAgNTYwIEwwIDQ0NS44NFE4OC4xMiA0MTMuOTYsIDEyMCA1MDIuMDhRMTQzLjQ3IDQ1My41NSwgMTkyIDQ3Ny4wMlEyMTQuNzIgNDI3Ljc0LCAyNjQgNDUwLjQ1UTMxNC41NiAzODEsIDM4NCA0MzEuNTZRNDQ2LjQ0IDQyMiwgNDU2IDQ4NC40M1E1MzEuNjIgNDQwLjA1LCA1NzYgNTE1LjY3UTYyOC44NyA0NDguNTQsIDY5NiA1MDEuNDFRNzQxLjk4IDQyNy4zOCwgODE2IDQ3My4zNlE4MzAuOTMgNDE2LjI5LCA4ODggNDMxLjIyUTkzMy44MSA0MDUuMDMsIDk2MCA0NTAuODQRMTA0OC43MiA0MTkuNTYsIDEwODAgNTA4LjI4UTEwOTkuOTggNDU2LjI1LCAxMTUyIDQ3Ni4yM1ExMTk2LjcxIDQwMC45NCwgMTI3MiA0NDUuNjVRMTMyMi44MSAzNzYuNDUsIDEzOTIgNDI3LjI2UTE0NDcuNzcgNDExLjAzLCAxNDY0IDQ2Ni44eiIgZmlsbD0iI2M2ZDlmNSI+PC9wYXRoPgogICAgICAgIDxwYXRoIGQ9Ik0xNTYwIDU2MEwwIDU2MCBMMCA1MzYuMzJRMzUuOTggNTAwLjMsIDcyIDUzNi4yN1ExMTkuMTkgNTExLjQ2LCAxNDQgNTU4LjY1UTE5MC43IDUzMy4zNSwgMjE2IDU4MC4wNFEyNTYuNzMgNTAwLjc2LCAzMzYgNTQxLjQ5UTM4NS43NiA0NzEuMjUsIDQ1NiA1MjEuMDFRNTEzLjI3IDUwNi4yOCwgNTI4IDU2My41NVE1ODAuNDMgNDk1Ljk4LCA2NDggNTQ4LjQxUTY2MS4xMiA0ODkuNTMsIDcyMCA1MDIuNjVRNzYxLjIyIDQ3MS44NywgNzkyIDUxMy4wOFE4NjkuNDIgNDcwLjUsIDkxMiA1NDcuOTNROTY3Ljg1IDUzMS43OCwgOTg0IDU4Ny42M1ExMDEyLjE5IDU0My44MiwgMTA1NiA1NzIuMDFRMTA4NS45NCA0ODEuOTUsIDExNzYgNTExLjlRMTIwNi43MiA0NzAuNjIsIDEyNDggNTAxLjM0UTEzMzIuNTMgNDY1Ljg3LCAxMzY4IDU1MC4zOVExMzg0LjY1IDQ5NS4wNCwgMTQ0MCA1MTEuNjlRMTUxMi45NyA0NjQuNjYsIDE1NjAgNTM3LjY0eiIgZmlsbD0iI2YxZjVmOSI+PC9wYXRoPgogICAgPC9nPgogICAgPGRlZnM+CiAgICAgICAgPG1hc2sgaWQ9IlN2Z2pzTWFzazEwMDAiPgogICAgICAgICAgICA8cmVjdCB3aWR0aD0iMTQ0MCIgaGVpZ2h0PSI1NjAiIGZpbGw9IiNmZmZmZmYiPjwvcmVjdD4KICAgICAgICA8L21hc2s+CiAgICA8L2RlZnM+Cjwvc3ZnPg==');"></div>
  <div class="fixed inset-0 -z-10 hidden bg-cover bg-center bg-no-repeat dark:block" style="background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZlcnNpb249IjEuMSIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHhtbG5zOnN2Z2pzPSJodHRwOi8vc3ZnanMuZGV2L3N2Z2pzIiB3aWR0aD0iMTQ0MCIgaGVpZ2h0PSI1NjAiIHByZXNlcnZlQXNwZWN0UmF0aW89Im5vbmUiIHZpZXdCb3g9IjAgMCAxNDQwIDU2MCI+CiAgICA8ZyBtYXNrPSJ1cmwoJnF1b3Q7I1N2Z2pzTWFzazEwMDAmcXVvdDspIiBmaWxsPSJub25lIj4KICAgICAgICA8cmVjdCB3aWR0aD0iMTQ0MCIgaGVpZ2h0PSI1NjAiIHg9IjAiIHk9IjAiIGZpbGw9IiMwZTJhNDciPjwvcmVjdD4KICAgICAgICA8cGF0aCBkPSJNMCwzMzAuMjE1QzgwLjgxMSwzMzcuNDExLDE2Mi44MzcsNDAyLjQ2LDIzNS42NTYsMzY2LjY4OEMzMDcuNzg5LDMzMS4yNTMsMzIxLjUzMiwyMzQuODQ3LDM0OC4zNTMsMTU5LjA4OEMzNzMuMDU3LDg5LjMwOCwzOTAuNzY3LDE4LjQ0LDM4NS4wNzUsLTU1LjM2NUMzNzkuMDk1LC0xMzIuOTEyLDM3MC40MDMsLTIxOC4zNTcsMzE1LjAzMywtMjcyLjk3OEMyNjAuNDQ3LC0zMjYuODI2LDE3Mi4xNjEsLTMxNC4yMzQsOTkuMDkzLC0zMzcuNDc4QzIzLjgzMywtMzYxLjQxOSwtNDIuMzg1LC00MjAuNDM2LC0xMjAuODcsLTQxMS42NDRDLTIwMy44NzQsLTQwMi4zNDYsLTI4OC4yMTcsLTM1OS4xNzEsLTMzMy41NDIsLTI4OS4wMTZDLTM3Ny42NjgsLTIyMC43MTgsLTM0OS4zMTMsLTEzMi4wNzEsLTM1My45NDUsLTUwLjg5Qy0zNTguMTEzLDIyLjE3LC0zODUuNDI0LDk1LjczNywtMzU5LjM5NywxNjQuMTMxQy0zMzIuNjY2LDIzNC4zNzUsLTI3OC4zNywyOTUuNDY0LC0yMTAuMTQ1LDMyNi45OTJDLTE0NS4yMzYsMzU2Ljk4OCwtNzEuMjIzLDMyMy44NzMsMCwzMzAuMjE1IiBmaWxsPSIjMGIyMjM5Ij48L3BhdGg+CiAgICAgICAgPHBhdGggZD0iTTE0NDAgMTE2MS4zNzE5OTk5OTk5OTk4QzE1NTAuNTkyIDExNDguMzExMDAwMDAwMDAwMSAxNjQxLjIyIDEwNzkuMDU5IDE3MzMuOTQ3MDAwMDAwMDAwMSAxMDE3LjM5MTAwMDAwMDAwMDEgMTgyNS4yMjkgOTU2LjY4MyAxOTM0LjcxOCA5MDYuMzQ0IDE5NzYuMTA4IDgwNC44MzIgMjAxNy4xMTcgNzA0LjI1NCAxOTcwLjYxMDk5OTk5OTk5OTkgNTkzLjMzMyAxOTUwLjM2MDAwMDAwMDAwMDEgNDg2LjYyMSAxOTMxLjA0MiAzODQuODI0IDE5MTkuNzY0MDAwMDAwMDAwMSAyODAuNjI2IDE4NjAuNSAxOTUuNjM0MDAwMDAwMDAwMDEgMTc5Ny4yOTMwMDAwMDAwMDAxIDEwNC45ODggMTcxMC40MzUgMzAuNTYyMDAwMDAwMDAwMDEyIDE2MDYuMzg5OTk5OTk5OTk5OS02LjY3MjAwMDAwMDAwMDAyNTUgMTQ5OC45NC00NS4xMjMwMDAwMDAwMDAwNSAxMzc3LjA0MS01Ny42NjMwMDAwMDAwMDAwMSAxMjcxLjA3Ny0xNS4yOTgwMDAwMDAwMDAwMDIgMTE2OC41MDkgMjUuNzA4OTk5OTk5OTk5OTk0NiAxMTI3LjM5MyAxNDQuMTQ5OTk5OTk5OTk5OTggMTA0NS4wMzIgMjE3Ljc1OTAwMDAwMDAwMDAxIDk0Ni4zMjEgMzA1Ljk4MSA3NjguNTI3IDMzMC4wNzcgNzM5Ljk5MyA0NTkuMzU0IDcxMS45MTkgNTg2LjU0OCA4NTIuNjcgNjg1LjU1OCA5MTYuNzQ5IDc5OC45NjEgOTc0LjQ3Mzk5OTk5OTk5OTkgOTAxLjExNzk5OTk5OTk5OTkgMTAwMS4zMDggMTAyNS43MTEgMTA5Ny43NjkgMTA5Mi41MjEgMTE5NS40MDUgMTE2MC4xNDUgMTMyMi4wNTIgMTE3NS4zMDEgMTQ0MCAxMTYxLjM3MTk5OTk5OTk5OTgiIGZpbGw9IiMxMTMyNTUiPjwvcGF0aD4KICAgIDwvZz4KICAgIDxkZWZzPgogICAgICAgIDxtYXNrIGlkPSJTdmdqc01hc2sxMDAwIj4KICAgICAgICAgICAgPHJlY3Qgd2lkdGg9IjE0NDAiIGhlaWdodD0iNTYwIiBmaWxsPSIjZmZmZmZmIj48L3JlY3Q+CiAgICAgICAgPC9tYXNrPgogICAgPC9kZWZzPgo8L3N2Zz4=');"></div>
  <header class="sticky top-0 z-40 bg-white dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <a href="/" class="text-xl font-bold text-teal-600 tracking-tight">Step Challenge</a>
      <nav class="flex items-center gap-4 sm:gap-6 text-sm font-medium">
        ${user
          ? `<a href="/dashboard" class="inline-flex items-center text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:text-slate-300 dark:hover:text-teal-400">Dashboard</a>
             <a href="/profile" class="inline-flex items-center text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:text-slate-300 dark:hover:text-teal-400">Profile</a>
             ${isAdmin ? `<a href="/admin" class="inline-flex items-center text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:text-slate-300 dark:hover:text-teal-400">Admin</a>` : ''}
             <button type="button" id="theme-toggle" aria-label="Toggle dark mode" class="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-teal-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-teal-400">
               <svg id="theme-icon-sun" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 hidden">
                 <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
               </svg>
               <svg id="theme-icon-moon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 hidden">
                 <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
               </svg>
             </button>
             <form method="post" action="/logout" class="flex items-center">
               <button type="submit" class="inline-flex items-center gap-1.5 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                   <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M18 12h-9m0 0 3-3m-3 3 3 3" />
                 </svg>
                 <span class="hidden sm:inline">Logout</span>
               </button>
             </form>`
          : `<a href="/login" class="inline-flex items-center text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:text-slate-300 dark:hover:text-teal-400">Login</a>
             <a href="/register" class="inline-flex items-center rounded-lg bg-teal-600 px-3 py-1.5 text-white hover:bg-teal-700">Register</a>`}
      </nav>
    </div>
  </header>

  <main class="flex-grow w-full">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      ${success ? `<div class="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">${escapeHtml(success)}</div>` : ''}
      ${flash ? `<div class="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">${escapeHtml(flash)}</div>` : ''}
      ${error ? `<div class="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">${escapeHtml(error)}</div>` : ''}
      ${body}
    </div>
  </main>

  <script>
    (function () {
      const toggle = document.getElementById('theme-toggle');
      if (!toggle) return;
      const sun = document.getElementById('theme-icon-sun');
      const moon = document.getElementById('theme-icon-moon');
      function updateIcons() {
        if (document.documentElement.classList.contains('dark')) {
          sun?.classList.remove('hidden');
          moon?.classList.add('hidden');
        } else {
          sun?.classList.add('hidden');
          moon?.classList.remove('hidden');
        }
      }
      updateIcons();
      toggle.addEventListener('click', function () {
        const root = document.documentElement;
        if (root.classList.contains('dark')) {
          root.classList.remove('dark');
          localStorage.setItem('theme', 'light');
        } else {
          root.classList.add('dark');
          localStorage.setItem('theme', 'dark');
        }
        updateIcons();
      });
    })();
  </script>

  <footer class="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-slate-500 dark:text-slate-400">
      Step Challenge — built for healthy competition.
    </div>
  </footer>
</body>
</html>`;
}

function inputClass(): string {
  return 'block w-full min-h-[44px] rounded-lg border border-slate-400 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200 sm:text-sm dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600 dark:focus:ring-teal-900';
}

function labelClass(): string {
  return 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';
}

export function homePage(user?: SessionUser): string {
  return layout(
    'Step Challenge',
    `<div class="max-w-2xl">
       <h1 class="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl mb-4">Step up together.</h1>
       <p class="text-lg text-slate-600 dark:text-slate-400 mb-8">Log your daily steps, upload proof, and help your team climb the leaderboard.</p>
        <div class="flex gap-3">
          <a href="/register" class="inline-flex items-center rounded-lg bg-teal-600 px-5 py-2.5 text-white font-medium hover:bg-teal-700">Get started</a>
          <a href="/login" class="inline-flex items-center rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 px-5 py-2.5 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-700">Log in</a>
        </div>
     </div>`,
    { user }
  );
}

export function registerPage(error?: string, user?: SessionUser): string {
  return layout(
    'Register',
    `<div class="mx-auto max-w-md rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/40">
       <h1 class="text-2xl font-bold tracking-tight mb-6">Create your account</h1>
       <form method="post" action="/register" class="space-y-4">
         <div>
           <label for="email" class="${labelClass()}">Work email</label>
           <input id="email" name="email" type="email" required class="${inputClass()}" placeholder="you@company.com">
         </div>
         <div>
           <label for="password" class="${labelClass()}">Password</label>
            <input id="password" name="password" type="password" autocomplete="new-password" required minlength="8" class="${inputClass()}" placeholder="At least 8 characters">
         </div>
         <div>
           <label for="displayName" class="${labelClass()}">Display name <span class="text-slate-400 font-normal">(optional)</span></label>
           <input id="displayName" name="displayName" maxlength="100" class="${inputClass()}" placeholder="What should we call you?">
         </div>
         <button type="submit" class="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-white font-medium hover:bg-teal-700">Create account</button>
       </form>
     </div>`,
    { user, error }
  );
}

export function loginPage(error?: string, success?: string, user?: SessionUser): string {
  return layout(
    'Login',
    `<div class="mx-auto max-w-md rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/40">
       <h1 class="text-2xl font-bold tracking-tight mb-6">Welcome back</h1>
       <form method="post" action="/login" class="space-y-4">
         <div>
           <label for="email" class="${labelClass()}">Email</label>
           <input id="email" name="email" type="email" required class="${inputClass()}">
         </div>
         <div>
           <label for="password" class="${labelClass()}">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required class="${inputClass()}">
         </div>
         <button type="submit" class="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-white font-medium hover:bg-teal-700">Login</button>
       </form>
     </div>`,
    { user, error, success }
  );
}

export function profilePage(
  user: SessionUser,
  options: { flash?: string; error?: string } = {}
): string {
  return layout(
    'Profile',
    `<div class="mx-auto max-w-md rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/40">
       <h1 class="text-2xl font-bold tracking-tight mb-6">Profile</h1>
       <form method="post" action="/profile" class="space-y-4">
         <div>
           <label for="displayName" class="${labelClass()}">Display name</label>
           <input id="displayName" name="displayName" maxlength="100" value="${escapeHtml(user.displayName ?? '')}" class="${inputClass()}" placeholder="What should we call you?">
         </div>
         <div>
           <label class="${labelClass()}">Email</label>
           <input type="text" disabled value="${escapeHtml(user.email)}" class="${inputClass()} bg-slate-100 text-slate-500 cursor-not-allowed">
         </div>
         <button type="submit" class="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-white font-medium hover:bg-teal-700">Update profile</button>
       </form>
     </div>`,
    { user, ...options }
  );
}

export function eventsListPage(
  user: SessionUser,
  events: Array<Event & { team_id: number | null; team_name: string | null; participant_status?: 'joined' | 'assigned_team' }>,
  options: { flash?: string; error?: string; joinableEvents?: Event[] } = {}
): string {
  const cards = events
    .map(
      (e) => `<a href="/dashboard/${e.id}" class="block rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/40 hover:ring-teal-500 transition">
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">${escapeHtml(e.name)}</h2>
          ${statusBadge(e.status)}
        </div>
        ${e.description ? `<p class="mt-1 text-slate-600 dark:text-slate-400">${escapeHtml(e.description)}</p>` : ''}
        <p class="mt-3 text-sm text-slate-500">Team: <span class="font-medium text-slate-900 dark:text-slate-100">${escapeHtml(e.team_name ?? 'Unassigned')}</span></p>
      </a>`
    )
    .join('');

  const joinableCards = (options.joinableEvents ?? [])
    .map(
      (e) => `<div class="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/40">
        <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">${escapeHtml(e.name)}</h2>
        ${e.description ? `<p class="mt-1 text-slate-600 dark:text-slate-400">${escapeHtml(e.description)}</p>` : ''}
        <form method="post" action="/dashboard/${e.id}/join" class="mt-4">
          <button type="submit" class="rounded-lg bg-teal-600 px-4 py-2 text-white font-medium hover:bg-teal-700">Join event</button>
        </form>
      </div>`
    )
    .join('');

  return layout(
    'Your events',
    `<div class="space-y-8">
       <h1 class="text-3xl font-bold tracking-tight">Your events</h1>
       <div class="grid gap-4 sm:grid-cols-2">${cards}</div>
       ${joinableCards ? `<div><h2 class="text-xl font-bold tracking-tight mb-4">Open events you can join</h2><div class="grid gap-4 sm:grid-cols-2">${joinableCards}</div></div>` : ''}
     </div>`,
    { user, ...options }
  );
}

export function noEventsPage(
  user: SessionUser,
  joinableEvents: Event[] = [],
  options: { flash?: string; error?: string } = {}
): string {
  const joinableCards = joinableEvents
    .map(
      (e) => `<div class="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/40">
        <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">${escapeHtml(e.name)}</h2>
        ${e.description ? `<p class="mt-1 text-slate-600 dark:text-slate-400">${escapeHtml(e.description)}</p>` : ''}
        <form method="post" action="/dashboard/${e.id}/join" class="mt-4">
          <button type="submit" class="rounded-lg bg-teal-600 px-4 py-2 text-white font-medium hover:bg-teal-700">Join event</button>
        </form>
      </div>`
    )
    .join('');

  return layout(
    'Dashboard',
    `<div class="space-y-6">
       <div class="rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/40 text-center">
         <h1 class="text-2xl font-bold tracking-tight mb-2">No events yet</h1>
         <p class="text-slate-600 dark:text-slate-400">You have not joined any events. Join an open event below or contact an admin.</p>
       </div>
       ${joinableCards ? `<div><h2 class="text-xl font-bold tracking-tight mb-4">Open events you can join</h2><div class="grid gap-4 sm:grid-cols-2">${joinableCards}</div></div>` : ''}
     </div>`,
    { user, ...options }
  );
}

function editModal(eventId: number, entry: StepEntry): string {
  const imagePreview = entry.image_key
    ? `<div class="mb-3"><img src="/uploads/${escapeHtml(entry.image_key)}" alt="Current proof" class="h-24 w-24 rounded-lg object-cover border border-slate-200 dark:border-slate-700"></div>`
    : '';
  return `<dialog id="edit-${entry.id}" class="rounded-2xl p-0 shadow-2xl ring-1 ring-slate-900/10 backdrop:bg-slate-900/40 open:animate-fade">
    <div class="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit entry</h3>
        <button type="button" onclick="document.getElementById('edit-${entry.id}').close()" class="text-slate-400 hover:text-slate-600 dark:text-slate-400">&times;</button>
      </div>
      <form method="post" action="/entries/${entry.id}" enctype="multipart/form-data" class="space-y-4">
        <input type="hidden" name="eventId" value="${eventId}">
        <div>
          <label for="entryDate-${entry.id}" class="${labelClass()}">Date</label>
          <input id="entryDate-${entry.id}" name="entryDate" type="date" required value="${escapeHtml(entry.entry_date)}" class="${inputClass()}">
        </div>
        <div>
          <label for="steps-${entry.id}" class="${labelClass()}">Steps</label>
          <input id="steps-${entry.id}" name="steps" type="number" min="1" required value="${escapeHtml(entry.steps)}" class="${inputClass()}">
        </div>
        <div>
          <label class="${labelClass()}">Current image</label>
          ${imagePreview || '<p class="text-sm text-slate-500">No image uploaded.</p>'}
          <label for="image-${entry.id}" class="${labelClass()}">Replace image <span class="text-slate-400 font-normal">(optional)</span></label>
          <input id="image-${entry.id}" name="image" type="file" accept="image/*" class="block w-full text-sm text-slate-600 dark:text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-teal-700 hover:file:bg-teal-100">
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button type="button" onclick="document.getElementById('edit-${entry.id}').close()" class="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
          <button type="submit" class="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">Save changes</button>
        </div>
      </form>
    </div>
  </dialog>`;
}

export function dashboardPage(
  user: SessionUser,
  event: Event,
  teamName: string | null,
  entries: StepEntry[],
  userStats: { total_steps: number; days_logged: number },
  teamStats: Array<{ team_name: string; total_steps: number }>,
  options: { flash?: string; error?: string } = {}
): string {
  const isActive = event.status === 'active';
  const isAccepting = event.status === 'accepting_participants';
  const today = new Date().toISOString().split('T')[0];
  const greeting = user.displayName ? `Hi, ${escapeHtml(user.displayName)}` : 'Dashboard';
  const average = userStats.days_logged > 0 ? Math.round(userStats.total_steps / userStats.days_logged) : 0;
  const teamStatsJson = JSON.stringify(teamStats).replace(/</g, '\\u003c');

  const entriesRows = entries
    .map(
      (e) => {
        const thumb = e.image_key
          ? `<a href="/uploads/${escapeHtml(e.image_key)}" target="_blank" class="inline-block"><img src="/uploads/${escapeHtml(e.image_key)}" alt="Proof" class="h-12 w-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 hover:ring-2 hover:ring-teal-500"></a>`
          : '<span class="text-slate-400">—</span>';
        return `<tr class="border-b border-slate-100 last:border-0">
          <td class="py-3 pr-4 text-sm text-slate-700 dark:text-slate-300">${escapeHtml(e.entry_date)}</td>
          <td class="py-3 pr-4 text-sm font-medium text-slate-900 dark:text-slate-100">${escapeHtml(e.steps.toLocaleString())}</td>
          <td class="py-3 pr-4">${thumb}</td>
          <td class="py-3 text-right">
            <button type="button" onclick="document.getElementById('edit-${e.id}').showModal()" class="text-sm font-medium text-teal-600 hover:text-teal-800">Edit</button>
          </td>
        </tr>${editModal(event.id, e)}`;
      }
    )
    .join('');

  const chartColors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

  const dateRange = [event.starts_at, event.ends_at]
    .filter(Boolean)
    .map((d) => new Date(d as string).toLocaleDateString())
    .join(' – ');

  const leaveButton = isAccepting
    ? `<button type="button" onclick="document.getElementById('leave-event-dialog').showModal()" class="text-sm font-medium text-rose-600 hover:text-rose-800">Leave event</button>
       <dialog id="leave-event-dialog" class="rounded-2xl p-0 shadow-2xl ring-1 ring-slate-900/10 backdrop:bg-slate-900/40 open:animate-fade">
         <div class="w-full max-w-sm p-6 bg-white dark:bg-slate-900 rounded-2xl">
           <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Leave event</h3>
           <p class="text-slate-600 dark:text-slate-400 mb-6">Are you sure you want to leave <span class="font-medium text-slate-900 dark:text-slate-100">${escapeHtml(event.name)}</span>? You can rejoin while the event is still accepting participants.</p>
           <div class="flex justify-end gap-3">
                  <button type="button" onclick="document.getElementById('leave-event-dialog').close()" class="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
             <form method="post" action="/dashboard/${event.id}/leave" class="inline">
               <button type="submit" class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">Leave event</button>
             </form>
           </div>
         </div>
       </dialog>`
    : '';

  const activeContent = isActive
    ? `<section class="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/40">
         <h2 class="text-lg font-semibold mb-4">Add today's steps</h2>
         <form method="post" action="/entries" enctype="multipart/form-data" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
           <input type="hidden" name="eventId" value="${event.id}">
           <div>
             <label for="entryDate" class="${labelClass()}">Date</label>
             <input id="entryDate" name="entryDate" type="date" required value="${today}" class="${inputClass()}">
           </div>
           <div>
             <label for="steps" class="${labelClass()}">Steps</label>
             <input id="steps" name="steps" type="number" min="1" required class="${inputClass()}" placeholder="0">
           </div>
           <div class="sm:col-span-2 lg:col-span-1">
             <label for="image" class="${labelClass()}">Proof image <span class="text-slate-400 font-normal">(optional)</span></label>
             <input id="image" name="image" type="file" accept="image/*" class="block w-full text-sm text-slate-600 dark:text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-teal-700 hover:file:bg-teal-100">
           </div>
           <div>
             <button type="submit" class="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-white font-medium hover:bg-teal-700">Save entry</button>
           </div>
         </form>
       </section>

       <section class="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/40">
         <h2 class="text-lg font-semibold mb-4">Stats</h2>
         <div class="grid gap-6 md:grid-cols-2">
           <div class="rounded-xl bg-slate-50 dark:bg-slate-800 p-5 ring-1 ring-slate-200">
             <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">Your stats</h3>
             <div class="grid grid-cols-2 gap-4">
               <div>
                 <span class="block text-3xl font-bold text-slate-900 dark:text-slate-100">${escapeHtml(userStats.total_steps.toLocaleString())}</span>
                 <span class="text-sm text-slate-600 dark:text-slate-400">Total steps</span>
               </div>
               <div>
                 <span class="block text-3xl font-bold text-slate-900 dark:text-slate-100">${escapeHtml(average.toLocaleString())}</span>
                 <span class="text-sm text-slate-600 dark:text-slate-400">Avg / day</span>
               </div>
             </div>
           </div>
           <div class="rounded-xl bg-slate-50 dark:bg-slate-800 p-5 ring-1 ring-slate-200 flex flex-col items-center">
             <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-2 w-full">Steps by team</h3>
             <div class="w-full max-w-xs">
               <canvas id="teamChart"></canvas>
             </div>
           </div>
         </div>
       </section>

       <section class="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/40">
         <h2 class="text-lg font-semibold mb-4">Your recent entries</h2>
         <div class="overflow-x-auto">
           <table class="w-full text-left">
             <thead>
               <tr class="border-b border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase tracking-wide text-slate-500">
                 <th class="pb-3 pr-4">Date</th>
                 <th class="pb-3 pr-4">Steps</th>
                 <th class="pb-3 pr-4">Image</th>
                 <th class="pb-3 text-right">Actions</th>
               </tr>
             </thead>
             <tbody>${entriesRows || '<tr><td colspan="4" class="py-6 text-center text-sm text-slate-500">No entries yet.</td></tr>'}</tbody>
           </table>
         </div>
       </section>

       <script type="application/json" id="team-stats-data">${teamStatsJson}</script>
       <script>
         (function() {
           const data = JSON.parse(document.getElementById('team-stats-data').textContent);
           const ctx = document.getElementById('teamChart').getContext('2d');
           const colors = ${JSON.stringify(chartColors)};
           new Chart(ctx, {
             type: 'pie',
             data: {
               labels: data.map(d => d.team_name),
               datasets: [{
                 data: data.map(d => d.total_steps),
                 backgroundColor: data.map((_, i) => colors[i % colors.length]),
                 borderWidth: 0
               }]
             },
             options: {
               responsive: true,
               plugins: {
                 legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
               }
             }
           });
         })();
       </script>`
    : '';

  const waitingMessage = isAccepting
    ? `<section class="rounded-2xl bg-amber-50 p-6 shadow-sm ring-1 ring-amber-200">
         <h2 class="text-lg font-semibold text-amber-900 mb-2">Waiting for the event to start</h2>
         <p class="text-amber-800">This event is still accepting participants. Step logging will open once an admin starts the event.</p>
         ${teamName ? `<p class="text-amber-800 mt-2">Your assigned team: <span class="font-semibold">${escapeHtml(teamName)}</span></p>` : ''}
       </section>`
    : '';

  return layout(
    'Dashboard',
    `<div class="space-y-8">
       <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
         <div>
           <div class="flex items-center gap-2">
             <h1 class="text-3xl font-bold tracking-tight">${greeting}</h1>
             ${statusBadge(event.status)}
           </div>
           <p class="text-slate-600 dark:text-slate-400 mt-1">
             Event: <span class="font-medium text-slate-900 dark:text-slate-100">${escapeHtml(event.name)}</span>
             ${dateRange ? `<span class="text-slate-400 mx-2">·</span><span class="text-slate-500">${escapeHtml(dateRange)}</span>` : ''}
           </p>
           <p class="text-slate-600 dark:text-slate-400 mt-1">Team: <span class="font-medium text-slate-900 dark:text-slate-100">${escapeHtml(teamName ?? 'Unassigned')}</span></p>
         </div>
         <div class="flex items-center gap-4">
           <a href="/dashboard" class="text-sm font-medium text-teal-600 hover:text-teal-800">Switch event</a>
           ${leaveButton}
         </div>
       </div>

       ${waitingMessage}
       ${activeContent}
     </div>`,
    { user, ...options }
  );
}

// Admin

function adminTabs(active: 'events' | 'users', content: string): string {
  const baseClasses = 'inline-flex items-center border-b-2 px-1 py-3 text-sm font-medium transition-colors';
  const activeClasses = 'border-teal-600 text-teal-600';
  const inactiveClasses = 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-300 hover:border-slate-300';
  const eventsClasses = active === 'events' ? activeClasses : inactiveClasses;
  const usersClasses = active === 'users' ? activeClasses : inactiveClasses;

  return `<div class="space-y-6">
    <h1 class="text-3xl font-bold tracking-tight">Admin</h1>
    <div class="border-b border-slate-200 dark:border-slate-700">
      <nav class="-mb-px flex gap-6">
        <a href="/admin/users" class="${baseClasses} ${usersClasses}">Users</a>
        <a href="/admin/events" class="${baseClasses} ${eventsClasses}">Events</a>
      </nav>
    </div>
    ${content}
  </div>`;
}

export function adminEventsPage(
  user: SessionUser,
  events: Event[],
  options: { flash?: string; error?: string } = {}
): string {
  const rows = events
    .map(
      (e) => `<tr class="border-b border-slate-100 last:border-0">
        <td class="py-3 pr-4 text-sm font-medium text-slate-900 dark:text-slate-100">
          <a href="/admin/events/${e.id}" class="text-teal-600 hover:text-teal-800">${escapeHtml(e.name)}</a>
        </td>
        <td class="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400">${escapeHtml(e.description ?? '—')}</td>
        <td class="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400">${statusBadge(e.status)}</td>
        <td class="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400">${e.starts_at ? escapeHtml(new Date(e.starts_at).toLocaleDateString()) : '—'}</td>
        <td class="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400">${e.ends_at ? escapeHtml(new Date(e.ends_at).toLocaleDateString()) : '—'}</td>
      </tr>`
    )
    .join('');

  return layout(
    'Admin — Events',
    adminTabs(
      'events',
      `<div class="space-y-8">
         <section class="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/40">
           <h2 class="text-xl font-bold tracking-tight mb-4">Events</h2>
           <div class="overflow-x-auto">
             <table class="w-full text-left">
               <thead>
                 <tr class="border-b border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase tracking-wide text-slate-500">
                   <th class="pb-3 pr-4">Name</th>
                   <th class="pb-3 pr-4">Description</th>
                   <th class="pb-3 pr-4">Status</th>
                   <th class="pb-3 pr-4">Starts</th>
                   <th class="pb-3 pr-4">Ends</th>
                 </tr>
               </thead>
               <tbody>${rows || '<tr><td colspan="5" class="py-6 text-center text-sm text-slate-500">No events yet.</td></tr>'}</tbody>
             </table>
           </div>
         </section>

         <section class="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/40">
           <h2 class="text-xl font-bold tracking-tight mb-4">Create event</h2>
           <form method="post" action="/admin/events" class="grid gap-4 sm:grid-cols-2 items-end">
             <div class="sm:col-span-2">
               <label for="name" class="${labelClass()}">Event name</label>
               <input id="name" name="name" required maxlength="120" class="${inputClass()}" placeholder="e.g. Summer Step Challenge">
             </div>
             <div class="sm:col-span-2">
               <label for="description" class="${labelClass()}">Description</label>
               <input id="description" name="description" maxlength="500" class="${inputClass()}" placeholder="Optional description">
             </div>
             <div>
               <label for="startsAt" class="${labelClass()}">Start date</label>
               <input id="startsAt" name="startsAt" type="date" class="${inputClass()}">
             </div>
             <div>
               <label for="endsAt" class="${labelClass()}">End date</label>
               <input id="endsAt" name="endsAt" type="date" class="${inputClass()}">
             </div>
             <div>
               <button type="submit" class="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-white font-medium hover:bg-teal-700">Create event</button>
             </div>
           </form>
         </section>
       </div>`
    ),
    { user, ...options }
  );
}

type ParticipantRow = {
  id: number;
  user_email: string;
  user_display_name: string | null;
  team_name: string | null;
  status: 'joined' | 'assigned_team';
};

type LeaderboardRow = {
  display_name: string;
  team_name: string;
  total_steps: number;
};

export function adminEventDetailPage(
  user: SessionUser,
  event: Event,
  teams: Team[],
  participants: ParticipantRow[],
  usersNotInEvent: User[],
  report: LeaderboardRow[],
  stats: { total_steps: number; participant_count: number; entry_count: number },
  pendingCount: number,
  teamMembers: Map<number, Array<{ id: number; user_email: string; user_display_name: string | null }>>,
  options: { flash?: string; error?: string } = {}
): string {
  const isAccepting = event.status === 'accepting_participants';
  const isActive = event.status === 'active';

  const teamOptions = teams
    .map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`)
    .join('');
  const userOptions = usersNotInEvent
    .map((u) => `<option value="${u.id}">${escapeHtml(u.display_name ?? u.email)} (${escapeHtml(u.email)})</option>`)
    .join('');

  const userDatalistOptions = usersNotInEvent
    .map((u) => `<option value="${u.id}">${escapeHtml(u.display_name ?? u.email)} (${escapeHtml(u.email)})</option>`)
    .join('');

  function editTeamDialog(team: Team): string {
    return `<dialog id="edit-team-${team.id}" class="rounded-2xl p-0 shadow-2xl ring-1 ring-slate-900/10 backdrop:bg-slate-900/40 open:animate-fade">
      <div class="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit team</h3>
          <button type="button" onclick="document.getElementById('edit-team-${team.id}').close()" class="text-slate-400 hover:text-slate-600 dark:text-slate-400">&times;</button>
        </div>
        <form method="post" action="/admin/events/${event.id}/teams/${team.id}" class="space-y-4">
          <div>
            <label for="edit-team-name-${team.id}" class="${labelClass()}">Team name</label>
            <input id="edit-team-name-${team.id}" name="name" required maxlength="100" value="${escapeHtml(team.name)}" class="${inputClass()}">
          </div>
          <div>
            <label for="edit-team-user-${team.id}" class="${labelClass()}">Add member <span class="text-slate-400 font-normal">(optional)</span></label>
            <input id="edit-team-user-${team.id}" name="addUserId" list="available-users-${team.id}" autocomplete="off" placeholder="Type to search users" class="${inputClass()}">
            <datalist id="available-users-${team.id}">${userDatalistOptions || ''}</datalist>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" onclick="document.getElementById('edit-team-${team.id}').close()" class="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
            <button type="submit" class="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">Confirm changes</button>
          </div>
        </form>
      </div>
    </dialog>`;
  }

  function teamDrawer(team: Team, members: Array<{ id: number; user_email: string; user_display_name: string | null }>): string {
    const memberRows = members
      .map(
        (m) => `<li class="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
          <div>
            <p class="text-sm font-medium text-slate-900 dark:text-slate-100">${escapeHtml(m.user_display_name ?? '-')}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(m.user_email)}</p>
          </div>
          ${isAccepting ? `<form method="post" action="/admin/events/${event.id}/participants/${m.id}/remove-from-team" class="inline"><button type="submit" class="ml-4 text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 text-lg leading-none" aria-label="Remove from team">&times;</button></form>` : ''}
        </li>`
      )
      .join('');
    return `<dialog id="team-drawer-${team.id}" class="fixed inset-y-0 right-0 m-0 ml-auto h-full max-h-full w-full max-w-sm rounded-l-2xl p-0 shadow-2xl ring-1 ring-slate-900/10 dark:ring-slate-700/40 backdrop:bg-slate-900/50 open:animate-fade">
      <div class="flex h-full flex-col bg-white dark:bg-slate-900 rounded-l-2xl">
        <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 p-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(team.name)} members</h3>
          <button type="button" onclick="document.getElementById('team-drawer-${team.id}').close()" class="text-slate-400 hover:text-slate-600 dark:text-slate-400 text-2xl leading-none">&times;</button>
        </div>
        <div class="flex-1 overflow-y-auto p-4">
          ${members.length > 0 ? `<ul>${memberRows}</ul>` : '<p class="text-sm text-slate-500 dark:text-slate-400">No members assigned.</p>'}
        </div>
      </div>
    </dialog>`;
  }

  function changeTeamDialog(participant: ParticipantRow): string {
    const teamRadios = teams
      .map(
        (t) => `<label class="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-teal-400 has-[:checked]:border-teal-600 has-[:checked]:ring-1 has-[:checked]:ring-teal-600">
          <input type="radio" name="teamId" value="${t.id}" ${t.name === participant.team_name ? 'checked' : ''} required class="h-4 w-4 text-teal-600 focus:ring-teal-600 border-slate-300">
          <span class="text-sm font-medium text-slate-900 dark:text-slate-100">${escapeHtml(t.name)}</span>
        </label>`
      )
      .join('');
    return `<dialog id="change-team-${participant.id}" class="rounded-2xl p-0 shadow-2xl ring-1 ring-slate-900/10 backdrop:bg-slate-900/40 open:animate-fade">
      <div class="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Change team</h3>
          <button type="button" onclick="document.getElementById('change-team-${participant.id}').close()" class="text-slate-400 hover:text-slate-600 dark:text-slate-400">&times;</button>
        </div>
        <form method="post" action="/admin/events/${event.id}/participants/${participant.id}/team" class="space-y-4">
          <div class="space-y-2">${teamRadios}</div>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" onclick="document.getElementById('change-team-${participant.id}').close()" class="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
            <button type="submit" class="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">Confirm</button>
          </div>
        </form>
      </div>
    </dialog>`;
  }

  const teamRows = teams
    .map(
      (t) => {
        const members = teamMembers.get(t.id) ?? [];
        return `<li class="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0 text-sm text-slate-700 dark:text-slate-300">
          <div class="flex items-center gap-2">
            <span class="font-medium text-slate-900 dark:text-slate-100">${escapeHtml(t.name)}</span>
            <span class="text-xs text-slate-500 dark:text-slate-400">(${members.length})</span>
          </div>
          <div class="flex items-center gap-3">
            <button type="button" onclick="document.getElementById('team-drawer-${t.id}').showModal()" class="text-sm font-medium text-teal-600 hover:text-teal-800 dark:text-teal-400">Members</button>
            ${isAccepting ? `<button type="button" onclick="document.getElementById('edit-team-${t.id}').showModal()" class="text-sm font-medium text-teal-600 hover:text-teal-800 dark:text-teal-400">Edit</button>${editTeamDialog(t)}` : ''}
            ${teamDrawer(t, members)}
          </div>
        </li>`;
      }
    )
    .join('');

  const participantRows = participants
    .map(
      (p) => {
        const statusBadge = p.status === 'assigned_team'
          ? `<span class="inline-flex items-center rounded-full bg-teal-100 dark:bg-teal-900/40 px-2 py-0.5 text-xs font-medium text-teal-800 dark:text-teal-300">Assigned team</span>`
          : `<span class="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">Joined</span>`;
        return `<tr class="border-b border-slate-100 dark:border-slate-700 last:border-0">
          <td class="py-3 pr-4 text-sm font-medium text-slate-900 dark:text-slate-100">${escapeHtml(p.user_display_name ?? '-')}</td>
          <td class="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400">${escapeHtml(p.user_email)}</td>
          <td class="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400">${escapeHtml(p.team_name ?? 'Unassigned')}</td>
          <td class="py-3 pr-4 text-sm">${statusBadge}</td>
          <td class="py-3 text-right">
            <div class="flex items-center justify-end gap-2">
              ${isAccepting && teams.length > 0 ? `<button type="button" onclick="document.getElementById('change-team-${p.id}').showModal()" class="rounded-md border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/30 px-2.5 py-1.5 text-sm font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50">Change team</button>${changeTeamDialog(p)}` : ''}
              ${isAccepting ? `<button type="button" onclick="document.getElementById('remove-participant-${p.id}').showModal()" class="rounded-md border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-900/30 px-2.5 py-1.5 text-sm font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50">Remove</button>
                <dialog id="remove-participant-${p.id}" class="rounded-2xl p-0 shadow-2xl ring-1 ring-slate-900/5 dark:ring-slate-700/40 backdrop:bg-slate-900/40 open:animate-fade">
                  <div class="w-full max-w-sm p-6 bg-white dark:bg-slate-900 rounded-2xl">
                    <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Remove participant</h3>
                    <p class="text-slate-600 dark:text-slate-400 mb-6">Remove <span class="font-medium text-slate-900 dark:text-slate-100">${escapeHtml(p.user_display_name ?? p.user_email)}</span> from this event?</p>
                    <div class="flex justify-end gap-3">
                      <button type="button" onclick="document.getElementById('remove-participant-${p.id}').close()" class="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
                      <form method="post" action="/admin/events/${event.id}/participants/${p.id}/remove" class="inline">
                        <button type="submit" class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">Remove</button>
                      </form>
                    </div>
                  </div>
                </dialog>` : ''}
            </div>
          </td>
        </tr>`;
      }
    )
    .join('');

  const reportRows = report
    .map(
      (r, i) => `<tr class="border-b border-slate-100 last:border-0">
        <td class="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400">${i + 1}</td>
        <td class="py-3 pr-4 text-sm font-medium text-slate-900 dark:text-slate-100">${escapeHtml(r.display_name ?? '-')}</td>
        <td class="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400">${escapeHtml(r.team_name)}</td>
        <td class="py-3 pr-4 text-sm text-slate-900 dark:text-slate-100 text-right">${escapeHtml(r.total_steps.toLocaleString())}</td>
      </tr>`
    )
    .join('');

  const dateRange = [event.starts_at, event.ends_at]
    .filter(Boolean)
    .map((d) => new Date(d as string).toLocaleDateString())
    .join(' – ');

  const startEventButton = isAccepting
    ? `<button type="button" onclick="document.getElementById('start-event-dialog').showModal()" class="rounded-lg bg-emerald-600 px-4 py-2 text-white font-medium hover:bg-emerald-700">Start event</button>
       <dialog id="start-event-dialog" class="rounded-2xl p-0 shadow-2xl ring-1 ring-slate-900/5 dark:ring-slate-700/40 backdrop:bg-slate-900/40 open:animate-fade">
         <div class="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl">
           <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Start event</h3>
           <p class="text-slate-600 dark:text-slate-400 mb-6">Once started, no new participants can join and teams cannot be changed. Are you sure?</p>
           <div class="flex justify-end gap-3">
              <button type="button" onclick="document.getElementById('start-event-dialog').close()" class="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
             <form method="post" action="/admin/events/${event.id}/start" class="inline">
               <button type="submit" class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Start event</button>
             </form>
           </div>
         </div>
       </dialog>`
    : '';

  const generateTeamsControl = isAccepting
    ? `<div class="flex flex-wrap items-end gap-3 mb-4">
         <div>
           <label for="numberOfTeams" class="${labelClass()}">Number of teams</label>
           <input id="numberOfTeams" name="numberOfTeams" type="number" min="1" max="100" required value="${Math.max(1, teams.length)}" class="${inputClass()} w-32">
         </div>
         <button type="button"
           onclick="document.getElementById('regenerate-teams-dialog').showModal(); document.getElementById('regenerate-numberOfTeams').value = document.getElementById('numberOfTeams').value;"
           title="Deletes all existing teams, creates new ones, and reassigns every participant."
           class="rounded-lg bg-teal-600 px-4 py-2.5 text-white font-medium hover:bg-teal-700">${teams.length > 0 ? 'Regenerate teams' : 'Generate teams'}</button>
         ${teams.length > 0 ? `<button type="button"
           onclick="document.getElementById('shuffle-teams-dialog').showModal()"
           title="Keeps the current teams but randomly reshuffles all participants across them."
           class="rounded-lg bg-teal-600 px-4 py-2.5 text-white font-medium hover:bg-teal-700">Shuffle teams</button>` : ''}
         ${pendingCount > 0
           ? `<form method="post" action="/admin/events/${event.id}/assign-pending" class="inline">
                <button type="submit" title="Randomly assigns all pending participants to the smallest teams." class="rounded-lg bg-amber-500 px-4 py-2.5 text-white font-medium hover:bg-amber-600">Assign ${pendingCount} pending</button>
              </form>`
           : ''}
       </div>
       <dialog id="regenerate-teams-dialog" class="rounded-2xl p-0 shadow-2xl ring-1 ring-slate-900/5 dark:ring-slate-700/40 backdrop:bg-slate-900/40 open:animate-fade">
         <div class="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl">
           <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">${teams.length > 0 ? 'Regenerate teams' : 'Generate teams'}</h3>
           <p class="text-slate-600 dark:text-slate-400 mb-6">This will remove all existing teams, create ${teams.length > 0 ? 'new' : ''} teams, and randomly assign every participant. Any manually edited team names will be lost.</p>
           <div class="flex justify-end gap-3">
             <button type="button" onclick="document.getElementById('regenerate-teams-dialog').close()" class="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
             <form method="post" action="/admin/events/${event.id}/generate-teams" class="inline">
               <input type="hidden" name="numberOfTeams" id="regenerate-numberOfTeams">
               <button type="submit" class="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">${teams.length > 0 ? 'Regenerate' : 'Generate'}</button>
             </form>
           </div>
         </div>
       </dialog>
       ${teams.length > 0 ? `<dialog id="shuffle-teams-dialog" class="rounded-2xl p-0 shadow-2xl ring-1 ring-slate-900/5 dark:ring-slate-700/40 backdrop:bg-slate-900/40 open:animate-fade">
         <div class="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl">
           <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Shuffle teams</h3>
           <p class="text-slate-600 dark:text-slate-400 mb-6">This will keep the current teams but randomly reshuffle all participants across them. No teams will be deleted.</p>
           <div class="flex justify-end gap-3">
             <button type="button" onclick="document.getElementById('shuffle-teams-dialog').close()" class="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
             <form method="post" action="/admin/events/${event.id}/shuffle-teams" class="inline">
               <button type="submit" class="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">Shuffle</button>
             </form>
           </div>
         </div>
       </dialog>` : ''}`
    : '';


  const reportsSection = isActive
    ? `<section class="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/40">
         <h2 class="text-lg font-semibold mb-4">Reports</h2>
         <div class="grid gap-4 sm:grid-cols-3 mb-6">
           <div class="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 ring-1 ring-slate-200">
             <span class="block text-2xl font-bold text-slate-900 dark:text-slate-100">${escapeHtml(stats.total_steps.toLocaleString())}</span>
             <span class="text-sm text-slate-600 dark:text-slate-400">Total steps</span>
           </div>
           <div class="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 ring-1 ring-slate-200">
             <span class="block text-2xl font-bold text-slate-900 dark:text-slate-100">${escapeHtml(stats.participant_count.toLocaleString())}</span>
             <span class="text-sm text-slate-600 dark:text-slate-400">Participants</span>
           </div>
           <div class="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 ring-1 ring-slate-200">
             <span class="block text-2xl font-bold text-slate-900 dark:text-slate-100">${escapeHtml(stats.entry_count.toLocaleString())}</span>
             <span class="text-sm text-slate-600 dark:text-slate-400">Entries</span>
           </div>
         </div>
         <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-2">Leaderboard</h3>
         <div class="overflow-x-auto">
           <table class="w-full text-left">
             <thead>
               <tr class="border-b border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase tracking-wide text-slate-500">
                 <th class="pb-3 pr-4">#</th>
                 <th class="pb-3 pr-4">User</th>
                 <th class="pb-3 pr-4">Team</th>
                 <th class="pb-3 pr-4 text-right">Steps</th>
               </tr>
             </thead>
             <tbody>${reportRows || '<tr><td colspan="4" class="py-6 text-center text-sm text-slate-500">No entries yet.</td></tr>'}</tbody>
           </table>
         </div>
       </section>`
    : '';

  const addParticipantForm = isAccepting
    ? `<form method="post" action="/admin/events/${event.id}/participants" class="grid gap-3 sm:grid-cols-3 items-end">
         <div class="sm:col-span-1">
           <label for="userId" class="${labelClass()}">User</label>
           <select id="userId" name="userId" required class="${inputClass()}">
             <option value="">Select user</option>
             ${userOptions || '<option value="" disabled>No users available</option>'}
           </select>
         </div>
         <div class="sm:col-span-1">
           <label for="teamId" class="${labelClass()}">Team <span class="text-slate-400 font-normal">(optional)</span></label>
           <select id="teamId" name="teamId" class="${inputClass()}">
             <option value="">Unassigned</option>
             ${teamOptions || ''}
           </select>
         </div>
         <div>
           <button type="submit" class="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-white font-medium hover:bg-teal-700">Add participant</button>
         </div>
       </form>`
    : '';

  return layout(
    `Admin — ${event.name}`,
    `<div class="space-y-8">
       <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
         <div>
           <div class="flex items-center gap-2">
             <h1 class="text-3xl font-bold tracking-tight">${escapeHtml(event.name)}</h1>
             ${statusBadge(event.status)}
           </div>
           ${event.description ? `<p class="text-slate-600 dark:text-slate-400 mt-1">${escapeHtml(event.description)}</p>` : ''}
           ${dateRange ? `<p class="text-sm text-slate-500 mt-1">${escapeHtml(dateRange)}</p>` : ''}
         </div>
          <div class="flex flex-wrap items-center gap-3">
            ${startEventButton}
            <button type="button" onclick="document.getElementById('delete-event-dialog').showModal()" class="rounded-lg bg-rose-600 px-4 py-2 text-white font-medium hover:bg-rose-700">Delete event</button>
          </div>
          <dialog id="delete-event-dialog" class="rounded-2xl p-0 shadow-2xl ring-1 ring-slate-900/10 backdrop:bg-slate-900/40 open:animate-fade">
            <div class="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl">
             <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Delete event</h3>
             <p class="text-slate-600 dark:text-slate-400 mb-6">Are you sure you want to delete <span class="font-medium text-slate-900 dark:text-slate-100">${escapeHtml(event.name)}</span>? This will also delete all teams, participants, and entries. This cannot be undone.</p>
             <div class="flex justify-end gap-3">
                <button type="button" onclick="document.getElementById('delete-event-dialog').close()" class="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
               <form method="post" action="/admin/events/${event.id}/delete" class="inline">
                 <button type="submit" class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">Delete event</button>
               </form>
             </div>
           </div>
         </dialog>
       </div>

       ${reportsSection}

         <section class="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/40">
           <h2 class="text-lg font-semibold mb-4">Teams</h2>
           ${generateTeamsControl}
           ${teamRows ? `<ul class="mb-4">${teamRows}</ul>` : '<p class="text-sm text-slate-500 mb-4">No teams yet.</p>'}
           ${isAccepting
            ? `<form method="post" action="/admin/events/${event.id}/teams" class="flex items-end gap-3">
                 <div class="flex-1">
                   <label for="teamName" class="${labelClass()}">New team name</label>
                   <input id="teamName" name="name" required maxlength="100" class="${inputClass()}" placeholder="e.g. Marketing">
                 </div>
                 <button type="submit" class="rounded-lg bg-teal-600 px-4 py-2.5 text-white font-medium hover:bg-teal-700">Create team</button>
               </form>`
            : ''}
        </section>

       <section class="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/40">
         <h2 class="text-lg font-semibold mb-4">Participants</h2>
         <div class="overflow-x-auto mb-4">
           <table class="w-full text-left">
               <thead>
                 <tr class="border-b border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th class="pb-3 pr-4">Display name</th>
                   <th class="pb-3 pr-4">Email</th>
                   <th class="pb-3 pr-4">Team</th>
                   <th class="pb-3 pr-4">Status</th>
                   ${isAccepting ? '<th class="pb-3 text-right">Actions</th>' : ''}
                 </tr>
               </thead>
               <tbody>${participantRows || `<tr><td colspan="${isAccepting ? 5 : 4}" class="py-6 text-center text-sm text-slate-500">No participants yet.</td></tr>`}</tbody>
           </table>
         </div>
         ${addParticipantForm}
        </section>
       </div>`,
    { user, ...options }
  );
}

export function adminUsersPage(
  user: SessionUser,
  users: Array<User & { organization_name: string }>,
  options: { flash?: string; error?: string } = {}
): string {
  function editUserDialog(u: User & { organization_name: string }): string {
    return `<dialog id="edit-user-${u.id}" class="rounded-2xl p-0 shadow-2xl ring-1 ring-slate-900/10 backdrop:bg-slate-900/40 open:animate-fade">
      <div class="w-full max-w-md sm:min-w-[460px] p-6 bg-white dark:bg-slate-900 rounded-2xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit user</h3>
          <button type="button" onclick="document.getElementById('edit-user-${u.id}').close()" class="text-slate-400 hover:text-slate-600 dark:text-slate-400">&times;</button>
        </div>
        <div class="mb-6 space-y-1">
          <p class="text-sm text-slate-600 dark:text-slate-400"><span class="font-medium text-slate-900 dark:text-slate-100">${escapeHtml(u.display_name ?? '-')}</span></p>
          <p class="text-sm text-slate-600 dark:text-slate-400">${escapeHtml(u.email)}</p>
          <p class="text-xs text-slate-500">${escapeHtml(u.organization_name)}</p>
        </div>

        <form method="post" action="/admin/users/${u.id}/role" class="space-y-4 mb-6">
          <label class="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-teal-400 has-[:checked]:border-teal-600 has-[:checked]:ring-1 has-[:checked]:ring-teal-600">
            <input type="checkbox" name="role" value="admin" ${u.role === 'admin' ? 'checked' : ''} class="h-4 w-4 text-teal-600 focus:ring-teal-600 border-slate-300">
            <span class="text-sm font-medium text-slate-900 dark:text-slate-100">Admin</span>
          </label>
          <div class="flex justify-end">
            <button type="submit" class="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">Save role</button>
          </div>
        </form>

        <div class="border-t border-slate-200 dark:border-slate-700 pt-6">
          <form method="post" action="/admin/users/${u.id}/reset-password" class="space-y-4">
            <div>
              <label for="reset-password-${u.id}" class="${labelClass()}">Reset password</label>
              <input id="reset-password-${u.id}" type="password" name="newPassword" autocomplete="new-password" required minlength="8" placeholder="New password" class="${inputClass()}">
            </div>
            <div class="flex justify-end">
              <button type="submit" class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600">Reset password</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>`;
  }

  const rows = users
    .map(
      (u) => `<tr class="border-b border-slate-100 last:border-0">
        <td class="py-3 pr-4 text-sm font-medium text-slate-900 dark:text-slate-100">${escapeHtml(u.display_name ?? '-')}</td>
        <td class="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400">${escapeHtml(u.email)}</td>
        <td class="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400">${escapeHtml(u.organization_name)}</td>
        <td class="py-3 pr-4 text-sm capitalize text-slate-600 dark:text-slate-400">${escapeHtml(u.role)}</td>
        <td class="py-3 text-right">
          <button type="button" onclick="document.getElementById('edit-user-${u.id}').showModal()" class="rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">Edit</button>
          ${editUserDialog(u)}
        </td>
      </tr>`
    )
    .join('');

  return layout(
    'Admin — Users',
    adminTabs(
      'users',
      `<div class="overflow-x-auto rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/40">
         <table class="w-full text-left">
           <thead>
             <tr class="border-b border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase tracking-wide text-slate-500">
               <th class="pb-3 pr-4">Display name</th>
               <th class="pb-3 pr-4">Email</th>
               <th class="pb-3 pr-4">Organization</th>
               <th class="pb-3 pr-4">Role</th>
               <th class="pb-3 text-right">Actions</th>
             </tr>
           </thead>
           <tbody>${rows || '<tr><td colspan="5" class="py-6 text-center text-sm text-slate-500">No users.</td></tr>'}</tbody>
         </table>
       </div>`
    ),
    { user, ...options }
  );
}

export function notFoundPage(user?: SessionUser): string {
  return layout('Not found', `<h1 class="text-2xl font-bold">Page not found</h1><p class="mt-2 text-slate-600 dark:text-slate-400"><a href="/" class="text-teal-600 hover:underline">Go home</a></p>`, { user });
}

export function unauthorizedPage(user?: SessionUser): string {
  return layout('Unauthorized', `<h1 class="text-2xl font-bold">Unauthorized</h1><p class="mt-2 text-slate-600 dark:text-slate-400">You do not have permission to view this page.</p>`, { user });
}
