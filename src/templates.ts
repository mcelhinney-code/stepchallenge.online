import type { SessionUser } from './auth';
import type { StepEntry, Team, User } from './db';
import { parseAllowedDomains } from './validation';

function escapeHtml(str: string | number | null | undefined): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function layout(
  title: string,
  body: string,
  options: { user?: SessionUser; flash?: string; error?: string; success?: string } = {}
): string {
  const { user, flash, error, success } = options;
  const display = user?.displayName ?? user?.email ?? '';
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
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] }
        }
      }
    }
  </script>
</head>
<body class="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
  <header class="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <a href="/" class="text-xl font-bold text-indigo-600 tracking-tight">Step Challenge</a>
      <nav class="flex items-center gap-4 sm:gap-6 text-sm font-medium">
        ${user
          ? `<a href="/dashboard" class="text-slate-600 hover:text-indigo-600">Dashboard</a>
             <a href="/profile" class="text-slate-600 hover:text-indigo-600">Profile</a>
             <form method="post" action="/logout" class="inline">
               <button type="submit" class="text-slate-500 hover:text-rose-600">Logout ${escapeHtml(display ? `(${display})` : '')}</button>
             </form>`
          : `<a href="/login" class="text-slate-600 hover:text-indigo-600">Login</a>
             <a href="/register" class="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700">Register</a>`}
      </nav>
    </div>
  </header>

  <main class="flex-grow w-full">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      ${success ? `<div class="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">${escapeHtml(success)}</div>` : ''}
      ${flash ? `<div class="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">${escapeHtml(flash)}</div>` : ''}
      ${error ? `<div class="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">${escapeHtml(error)}</div>` : ''}
      ${body}
    </div>
  </main>

  <footer class="border-t border-slate-200 bg-white">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-slate-500">
      Step Challenge — built for healthy competition.
    </div>
  </footer>
</body>
</html>`;
}

function inputClass(): string {
  return 'block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm';
}

function labelClass(): string {
  return 'block text-sm font-medium text-slate-700 mb-1';
}

export function homePage(): string {
  return layout(
    'Step Challenge',
    `<div class="max-w-2xl">
       <h1 class="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl mb-4">Step up together.</h1>
       <p class="text-lg text-slate-600 mb-8">Log your daily steps, upload proof, and help your team climb the leaderboard.</p>
       <div class="flex gap-3">
         <a href="/register" class="inline-flex items-center rounded-lg bg-indigo-600 px-5 py-2.5 text-white font-medium hover:bg-indigo-700">Get started</a>
         <a href="/login" class="inline-flex items-center rounded-lg bg-white border border-slate-300 px-5 py-2.5 text-slate-700 font-medium hover:bg-slate-50">Log in</a>
       </div>
     </div>`
  );
}

export function registerPage(error?: string): string {
  return layout(
    'Register',
    `<div class="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-900/5">
       <h1 class="text-2xl font-bold tracking-tight mb-6">Create your account</h1>
       <form method="post" action="/register" class="space-y-4">
         <div>
           <label for="email" class="${labelClass()}">Email</label>
           <input id="email" name="email" type="email" required class="${inputClass()}" placeholder="you@company.com">
         </div>
         <div>
           <label for="password" class="${labelClass()}">Password</label>
           <input id="password" name="password" type="password" required minlength="8" class="${inputClass()}" placeholder="At least 8 characters">
         </div>
         <div>
           <label for="displayName" class="${labelClass()}">Display name <span class="text-slate-400 font-normal">(optional)</span></label>
           <input id="displayName" name="displayName" maxlength="100" class="${inputClass()}" placeholder="What should we call you?">
         </div>
         <button type="submit" class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-white font-medium hover:bg-indigo-700">Continue</button>
       </form>
     </div>`,
    { error }
  );
}

export function registerTeamPage(
  email: string,
  teams: Team[],
  error?: string,
  token?: string
): string {
  const teamOptions = teams
    .map(
      (t) => {
        const domains = parseAllowedDomains(t.allowed_domains);
        return `<label class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-400 has-[:checked]:border-indigo-600 has-[:checked]:ring-1 has-[:checked]:ring-indigo-600">
        <input type="radio" name="teamId" value="${t.id}" required class="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-600 border-slate-300">
        <div>
          <span class="block font-semibold text-slate-900">${escapeHtml(t.name)}</span>
          <span class="block text-xs text-slate-500">${escapeHtml(domains.map((d) => '@' + d).join(', '))}</span>
        </div>
      </label>`;
      }
    )
    .join('');
  const tokenField = token ? `<input type="hidden" name="token" value="${escapeHtml(token)}">` : '';
  return layout(
    'Choose your team',
    `<div class="mx-auto max-w-md">
       <h1 class="text-2xl font-bold tracking-tight mb-2">Choose your team</h1>
       <p class="text-slate-600 mb-6">Teams available for <span class="font-medium text-slate-900">${escapeHtml(email)}</span></p>
       <form method="post" action="/register/team" class="space-y-3">
         ${tokenField}
         ${teamOptions}
         <button type="submit" class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-white font-medium hover:bg-indigo-700 mt-4">Complete registration</button>
       </form>
     </div>`,
    { error }
  );
}

export function loginPage(error?: string, success?: string): string {
  return layout(
    'Login',
    `<div class="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-900/5">
       <h1 class="text-2xl font-bold tracking-tight mb-6">Welcome back</h1>
       <form method="post" action="/login" class="space-y-4">
         <div>
           <label for="email" class="${labelClass()}">Email</label>
           <input id="email" name="email" type="email" required class="${inputClass()}">
         </div>
         <div>
           <label for="password" class="${labelClass()}">Password</label>
           <input id="password" name="password" type="password" required class="${inputClass()}">
         </div>
         <button type="submit" class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-white font-medium hover:bg-indigo-700">Login</button>
       </form>
     </div>`,
    { error, success }
  );
}

function editModal(entry: StepEntry): string {
  const imagePreview = entry.image_key
    ? `<div class="mb-3"><img src="/uploads/${escapeHtml(entry.image_key)}" alt="Current proof" class="h-24 w-24 rounded-lg object-cover border border-slate-200"></div>`
    : '';
  return `<dialog id="edit-${entry.id}" class="rounded-2xl p-0 shadow-2xl ring-1 ring-slate-900/10 backdrop:bg-slate-900/40 open:animate-fade">
    <div class="w-full max-w-md p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-slate-900">Edit entry</h3>
        <button type="button" onclick="document.getElementById('edit-${entry.id}').close()" class="text-slate-400 hover:text-slate-600">&times;</button>
      </div>
      <form method="post" action="/entries/${entry.id}" enctype="multipart/form-data" class="space-y-4">
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
          <input id="image-${entry.id}" name="image" type="file" accept="image/*" class="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-indigo-700 hover:file:bg-indigo-100">
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button type="button" onclick="document.getElementById('edit-${entry.id}').close()" class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Save changes</button>
        </div>
      </form>
    </div>
  </dialog>`;
}

export function dashboardPage(
  user: SessionUser,
  teamName: string,
  entries: StepEntry[],
  options: { flash?: string; error?: string } = {}
): string {
  const today = new Date().toISOString().split('T')[0];
  const greeting = user.displayName ? `Hi, ${escapeHtml(user.displayName)}` : 'Dashboard';
  const entriesRows = entries
    .map(
      (e) => {
        const thumb = e.image_key
          ? `<a href="/uploads/${escapeHtml(e.image_key)}" target="_blank" class="inline-block"><img src="/uploads/${escapeHtml(e.image_key)}" alt="Proof" class="h-12 w-12 rounded-lg object-cover border border-slate-200 hover:ring-2 hover:ring-indigo-500"></a>`
          : '<span class="text-slate-400">—</span>';
        return `<tr class="border-b border-slate-100 last:border-0">
          <td class="py-3 pr-4 text-sm text-slate-700">${escapeHtml(e.entry_date)}</td>
          <td class="py-3 pr-4 text-sm font-medium text-slate-900">${escapeHtml(e.steps.toLocaleString())}</td>
          <td class="py-3 pr-4">${thumb}</td>
          <td class="py-3 text-right">
            <button type="button" onclick="document.getElementById('edit-${e.id}').showModal()" class="text-sm font-medium text-indigo-600 hover:text-indigo-800">Edit</button>
          </td>
        </tr>${editModal(e)}`;
      }
    )
    .join('');
  return layout(
    'Dashboard',
    `<div class="space-y-8">
       <div>
         <h1 class="text-3xl font-bold tracking-tight">${greeting}</h1>
         <p class="text-slate-600 mt-1">Team: <span class="font-medium text-slate-900">${escapeHtml(teamName)}</span></p>
       </div>

       <section class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
         <h2 class="text-lg font-semibold mb-4">Add today's steps</h2>
         <form method="post" action="/entries" enctype="multipart/form-data" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
           <input type="hidden" name="teamId" value="${user.teamId}">
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
             <input id="image" name="image" type="file" accept="image/*" class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-indigo-700 hover:file:bg-indigo-100">
           </div>
           <div>
             <button type="submit" class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-white font-medium hover:bg-indigo-700">Save entry</button>
           </div>
         </form>
       </section>

       <section class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
         <h2 class="text-lg font-semibold mb-4">Your recent entries</h2>
         <div class="overflow-x-auto">
           <table class="w-full text-left">
             <thead>
               <tr class="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
     </div>`,
    { user, ...options }
  );
}

export function profilePage(
  user: SessionUser,
  options: { flash?: string; error?: string } = {}
): string {
  return layout(
    'Profile',
    `<div class="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-900/5">
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
         <button type="submit" class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-white font-medium hover:bg-indigo-700">Update profile</button>
       </form>
     </div>`,
    { user, ...options }
  );
}

export function adminPage(
  pendingUsers: Array<User & { team_name: string }>,
  secret: string,
  options: { flash?: string; error?: string } = {}
): string {
  const rows = pendingUsers
    .map(
      (u) => `<tr class="border-b border-slate-100 last:border-0">
        <td class="py-3 pr-4 text-sm font-medium text-slate-900">${escapeHtml(u.display_name ?? '-')}</td>
        <td class="py-3 pr-4 text-sm text-slate-600">${escapeHtml(u.email)}</td>
        <td class="py-3 pr-4 text-sm text-slate-600">${escapeHtml(u.team_name)}</td>
        <td class="py-3 text-right">
          <form method="post" action="/admin/users/${u.id}/approve?secret=${encodeURIComponent(secret)}">
            <button type="submit" class="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Approve</button>
          </form>
        </td>
      </tr>`
    )
    .join('');
  return layout(
    'Admin',
    `<div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
       <h1 class="text-2xl font-bold tracking-tight mb-4">Pending registrations</h1>
       <div class="overflow-x-auto">
         <table class="w-full text-left">
           <thead>
             <tr class="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
               <th class="pb-3 pr-4">Display name</th>
               <th class="pb-3 pr-4">Email</th>
               <th class="pb-3 pr-4">Team</th>
               <th class="pb-3 text-right">Action</th>
             </tr>
           </thead>
           <tbody>${rows || '<tr><td colspan="4" class="py-6 text-center text-sm text-slate-500">No pending users.</td></tr>'}</tbody>
         </table>
       </div>
     </div>`,
    options
  );
}

export function notFoundPage(): string {
  return layout('Not found', `<h1 class="text-2xl font-bold">Page not found</h1><p class="mt-2 text-slate-600"><a href="/" class="text-indigo-600 hover:underline">Go home</a></p>`);
}

export function unauthorizedPage(): string {
  return layout('Unauthorized', `<h1 class="text-2xl font-bold">Unauthorized</h1><p class="mt-2 text-slate-600">You do not have permission to view this page.</p>`);
}
