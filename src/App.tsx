// @ts-nocheck
import React, { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button, Card, CardHeader, CardTitle, CardDesc, CardContent, Badge, Input, Textarea, Label, Checkbox, Progress, Avatar, Separator, Dialog, Tabs, Segmented, RadioGroup, RadioGroupItem, ShAlert, AlertTitle, AlertDescription } from './ui-shim'
import { Select as ShSelect, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarGroupAction, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuBadge, SidebarInset, SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { IconInnerShadowTop, IconCirclePlusFilled, IconMail, IconHome, IconUsers, IconListDetails, IconCalendar, IconInbox, IconFolder, IconSettings, IconHelp, IconSearch, IconAdjustments, IconDotsVertical, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'



/* ================= shadcn/ui primitives ================= */
const P={
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
 cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
 inbox:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
 cog:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
 plus:'<path d="M5 12h14M12 5v14"/>',search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',
 back:'<path d="m15 18-6-6 6-6"/>',chev:'<path d="m9 18 6-6-6-6"/>',
 alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
 ban:'<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',check:'<path d="M20 6 9 17l-5-5"/>',
 pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
 edit:'<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
 trash:'<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
 eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/>',
 swap:'<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',help:'<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
 link:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
 star:'<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',kanban:'<rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="10" rx="1"/>',filter:'<path d="M4 6h16M7 12h10M10 18h4"/>',flag:'<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',home:'<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',user:'<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',msg:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',updown:'<path d="m7 15 5 5 5-5M7 9l5-5 5 5"/>',down:'<path d="m6 9 6 6 6-6"/>', target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',spin:'<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>',alertc:'<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',checkc:'<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>', pencil:'<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>', turn:'<path d="m15 14 5-5-5-5"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>', dash:'<circle cx="12" cy="12" r="9" stroke-dasharray="3.5 3.5"/>',pause:'<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>', clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
};
const Icon=({n,c='h-4 w-4'})=><svg className={cn(c,'shrink-0')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{__html:P[n]}}/>;

const Select=({className,children,value,defaultValue,onChange,size})=>{const opts=React.Children.toArray(children).filter(Boolean).map(o=>({v:o.props.value!=null?String(o.props.value):String(o.props.children),l:o.props.children}));const [iv,setIv]=React.useState(defaultValue??opts[0]?.v);const cur=value!=null?String(value):iv;return <ShSelect value={cur} onValueChange={v=>{setIv(v);onChange&&onChange({target:{value:v}})}}><SelectTrigger size={size} className={cn('w-full',className)}><SelectValue placeholder={opts.find(o=>o.v==='')?.l}/></SelectTrigger><SelectContent>{opts.filter(o=>o.v!=='').map(o=><SelectItem key={o.v} value={o.v||'__empty'} disabled={o.v===''}>{o.l}</SelectItem>)}</SelectContent></ShSelect>};
const Alert=({variant='default',icon='alert',title,children,className})=><ShAlert variant={variant==='destructive'?'destructive':'default'} className={className}><Icon n={icon}/><AlertTitle>{title}</AlertTitle><AlertDescription>{children}</AlertDescription></ShAlert>;
const DatePicker=({value,onChange,min,placeholder='Pick a date'})=>{const [open,setOpen]=React.useState(false);const d=value?new Date(value+'T00:00'):undefined;const fmt=x=>x.toLocaleString('en',{day:'numeric',month:'short',year:'numeric'});return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="outline" className={cn('w-full justify-start font-normal',!d&&'text-muted-foreground')}><Icon n="cal"/>{d?fmt(d):placeholder}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={d} defaultMonth={d} disabled={min?{before:new Date(min+'T00:00')}:undefined} onSelect={x=>{if(x){onChange(dkey(x));setOpen(false)}}}/></PopoverContent></Popover>};
const tone=p=>p>=100?{t:'text-green-600',b:'bg-green-600'}:p>=75?{t:'text-blue-600',b:'bg-blue-600'}:p>=50?{t:'text-amber-500',b:'bg-amber-500'}:p>=25?{t:'text-orange-500',b:'bg-orange-500'}:{t:'text-destructive',b:'bg-destructive'};
const Field=({label,children})=><div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
const AREA_OF={'DES-142':'Checkout','DES-145':'Onboarding','DES-139':'Tokens','DES-150':'Settings','DES-151':'Icons'};
const BA_OF={'DES-108':'Kiran','DES-119':'Priya','DES-127':'Priya','DES-155':'Kiran','DES-124':'Kiran','DES-116':'Priya','DES-105':'Kiran','DES-121':'Priya','DES-118':'Kiran','DES-112':'Priya','DES-142':'Priya','DES-145':'Kiran','DES-139':'Priya','DES-150':'Kiran','DES-151':'Priya'};

/* ================= data ================= */
const TEAM=[
 {n:'Subash',loc:'Office',av:'Available',plan:['Checkout redesign','Onboarding copy pass'],load:[5,8]},
 {n:'Ben',loc:'Remote',av:'Partial',note:'Workshop 2–5 pm',plan:['Design tokens audit'],load:[6,7]},
 {n:'Chen',loc:null,av:'Away',note:'On leave',plan:[],load:[3,6]},
 {n:'Dia',loc:'Remote',av:'Available',plan:['Settings IA','Icon set v2'],load:[7,10]}];
const DAYS=['Mon 29','Tue 30','Wed 1','Thu 2','Fri 3','Mon 6','Tue 7','Wed 8','Thu 9','Fri 10'];
const initStories=()=>[
 {reviews:[{id:1,by:'Ravi',role:'Lead',text:'Payment step feels crowded. Can we split address and payment?',at:'yesterday',replies:[]}],k:'DES-142',t:'Checkout redesign',who:'Subash',st:'In progress',due:'Oct 2',base:'Oct 2',est:4,chk:[['Flows',1],['Wireframes',1],['Hi-fi',0],['Handoff notes',0]]},
 {k:'DES-145',t:'Onboarding copy pass',who:'Ben',st:'In progress',blocker:{on:'Legal · copy sign-off',ack:false},due:'Oct 1',base:'Sep 30',est:1.5,chk:[['Audit',1],['Tone guide',1],['Rewrite screens',1],['Legal review',1],['Final pass',0]],risk:'Copy needs legal',moved:'Scope grew'},
 {k:'DES-139',t:'Design tokens audit',who:'Ben',st:'In progress',due:'Oct 3',base:'Oct 3',est:3,chk:[['Colors',1],['Type',0]],blocker:{on:'PM · brand palette sign-off',ack:false}},
 {k:'DES-150',t:'Settings IA',who:'Dia',st:'In progress',due:'Sep 28',base:'Sep 25',est:2,chk:[['Card sort',1],['Map',0]],overdue:1,moved:'Waiting on input'},
 {reviews:[{id:2,by:'Meera',role:'Manager',text:'Stroke weight looks uneven on the small sizes.',at:'2h ago',replies:[{by:'Dia',text:'Fixed in the latest export.',at:'1h ago'}]}],k:'DES-151',t:'Icon set v2',who:'Dia',st:'Approval pending',due:'Oct 6',base:'Oct 6',est:5,chk:[['Draft',1],['Polish',1]]},
 {proto:'https://figma.com/proto/team-calendar-v3',k:'DES-130',t:'Team calendar spec',who:'Ben',st:'Done',due:'Sep 24',base:'Sep 24',est:2,chk:[['Draft',1],['Sign-off',1]]},
 {k:'DES-121',t:'Profile page refresh',who:'Subash',team:['Subash','Ben'],st:'Done',doneOn:'2026-09-22',pct:100,proto:'https://figma.com/proto/profile-refresh',due:'Sep 22',base:'Sep 22',est:3,chk:[['Layout',1],['Polish',1]]},
 {k:'DES-118',t:'Search results states',who:'Subash',team:['Subash'],st:'Done',doneOn:'2026-09-15',pct:100,proto:'https://figma.com/proto/search-states',due:'Sep 15',base:'Sep 15',est:2,chk:[['States',1]]},
 {k:'DES-112',t:'Help centre navigation',who:'Subash',team:['Subash','Chen'],st:'Done',doneOn:'2026-09-08',pct:100,proto:'https://figma.com/proto/help-nav',due:'Sep 8',base:'Sep 8',est:2,chk:[['IA',1],['Nav',1]]},
 {k:'DES-124',t:'Notification settings',who:'Subash',team:['Subash','Dia'],st:'Done',doneOn:'2026-09-24',pct:100,proto:'https://figma.com/proto/notif-settings',due:'Sep 24',base:'Sep 24',est:2,chk:[['Flows',1]]},
 {k:'DES-116',t:'Onboarding illustrations',who:'Subash',team:['Subash'],st:'Done',doneOn:'2026-09-17',pct:100,proto:'https://figma.com/proto/onboarding-illus',due:'Sep 17',base:'Sep 17',est:2,chk:[['Sketch',1]]},
 {k:'DES-105',t:'Billing page audit',who:'Subash',team:['Subash','Ben'],st:'Done',doneOn:'2026-09-02',pct:100,proto:'https://figma.com/proto/billing-audit',due:'Sep 2',base:'Sep 2',est:2,chk:[['Audit',1]]},
 {k:'DES-108',t:'Advisor mapping',who:'Subash',team:['Subash','Dia'],st:'Done',doneOn:'2026-09-10',pct:100,proto:'https://figma.com/proto/advisor-mapping',due:'Sep 10',base:'Sep 10',est:5,chk:[['Research',1],['Flows',1],['Hi-fi',1]]},
 {k:'DES-119',t:'Transfer request',who:'Subash',team:['Subash'],st:'Done',doneOn:'2026-09-25',pct:100,proto:'https://figma.com/proto/transfer-request',due:'Sep 25',base:'Sep 25',est:3,chk:[['Flow',1],['Screens',1]]},
 {k:'DES-127',t:'Style guide',who:'Subash',team:['Subash','Ben','Chen'],st:'Done',doneOn:'2026-09-28',pct:100,proto:'https://figma.com/proto/style-guide',due:'Sep 28',base:'Sep 28',est:6,chk:[['Colour',1],['Type',1],['Components',1]]},
 {k:'DES-155',t:'Distribution revamp',who:'Subash',st:'To do',due:'Oct 9',base:'Oct 9',est:5,pct:0,chk:[],reviews:[],iter:0},
 {k:'DES-153',t:'Empty states',who:'Chen',st:'To do',due:'Oct 8',base:'Oct 8',est:3,chk:[]}];
const META={'DES-108':['Map advisors to client accounts and ownership rules','2 Sep','High',3,3],'DES-119':['Let participants request an account transfer end to end','22 Sep','Medium',2,2],'DES-127':['Shared colour, type and component guidance for the team','16 Sep','Medium',3,3],'DES-155':['Rework how distributions are requested and reviewed','29 Sep','High',0,0],'DES-124':['Let people control which alerts they receive','19 Sep','Medium',1,1],'DES-116':['Illustration set for the first-run flow','12 Sep','Low',1,1],'DES-105':['Review the billing page for clarity gaps','28 Aug','Medium',1,1],'DES-121':['Refresh layout and details of the profile page','16 Sep','Medium',2,2],'DES-118':['Empty, loading and error states for search','11 Sep','Medium',1,1],'DES-112':['Simplify help centre navigation structure','3 Sep','Low',2,2],'DES-142':['Rebuild cart, address and payment steps',  '24 Sep','High',3,6],'DES-145':['Tighten tone across first-run screens','25 Sep','Medium',1,3],'DES-139':['Audit colour and type tokens vs code','23 Sep','High',2,4],'DES-150':['Restructure settings navigation','22 Sep','Medium',2,5],'DES-151':['Refresh 120 icons, 2px stroke','24 Sep','Low',3,5],'DES-130':['Spec for month and week views','15 Sep','Low',1,2],'DES-153':['Empty, error and zero-data states','2 Oct','Medium',0,1]};
const TYPE={'DES-142':'Design','DES-145':'Content','DES-139':'System','DES-150':'Research','DES-151':'Review','DES-130':'Handoff','DES-153':'Design'};
const TYPEC={Design:'bg-accent text-muted-foreground',Content:'bg-muted text-muted-foreground',System:'bg-muted text-muted-foreground',Research:'bg-muted text-muted-foreground',Review:'bg-muted text-muted-foreground',Handoff:'bg-muted text-muted-foreground'};
const dkey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const HIST=(()=>{const T=[['DES-142','Checkout redesign'],['DES-145','Onboarding copy pass'],['DES-160','Cart empty state'],['DES-131','Payment flows'],['DES-128','Address form']],N=['Wireframes','Hi-fi pass','Copy edits','Review fixes','Handoff notes','Prototype polish'],L={'2026-09-11':'Annual leave','2026-08-14':'Annual leave'};const h={};let i=0;
 for(let d=new Date('2026-08-03T00:00');d<new Date('2026-09-29T00:00');d.setDate(d.getDate()+1)){const w=d.getDay();if(w===0||w===6)continue;const k=dkey(d);i++;
  if(L[k]){h[k]=[{leave:L[k]}];continue}
  const e=[{k:T[i%5][0],t:T[i%5][1],note:N[i%6],loc:i%4===0?'Remote':'Office'}];if(i%3===0)e.push({k:T[(i+2)%5][0],t:T[(i+2)%5][1],note:N[(i+3)%6],loc:e[0].loc});if(i%7===0)e.push({k:T[i%5][0],t:T[i%5][1],note:'Sent to BA · approval pending',loc:e[0].loc,ev:1});h[k]=e}
 return h})();
const PRI={High:['bg-destructive/10 text-destructive','text-destructive'],Medium:['bg-muted text-muted-foreground','text-muted-foreground'],Low:['bg-accent text-muted-foreground','text-muted-foreground']};
const GROUPS=[['To do','To Do','bg-accent/70','text-muted-foreground','bg-muted','target'],['In progress','In Progress','bg-muted','text-muted-foreground','bg-muted','spin'],['Approval pending','Approval pending · BA','bg-muted','text-muted-foreground','bg-muted','alertc'],['Done','Completed','bg-muted','text-muted-foreground','bg-muted','checkc']];
const initInbox=()=>[
 {id:1,lead:1,lvl:'Important',t:'Ben raised a blocker on DES-139',d:'Waiting on PM · brand palette sign-off',act:'Acknowledge',to:['team','attn']},
 {id:2,lead:1,lvl:'Important',t:'Ben requested leave · Oct 9',d:'1 story due in that range',act:'Review',to:['leave']},
 {id:3,lead:1,lvl:'Info',t:'Icon set v2 is waiting for review',d:'Dia · 5 days',act:'Review',to:['team','attn']},
 {id:4,lead:0,lvl:'Info',t:'Your leave Oct 5–7 was approved',d:'by Ravi'},
 {id:5,lead:0,lvl:'Info',t:'DES-145 is due tomorrow',d:'1 checklist item still open',act:'Open',to:['story','DES-145']}];

/* ================= app ================= */
const SB={'In progress':['spin','In progress','bg-blue-500/10 text-blue-600 border-blue-500/25'],'Input required':['alert','Input required','bg-rose-500/10 text-rose-600 border-rose-500/25'],'Review pending':['eye','Review pending','bg-sky-500/10 text-sky-600 border-sky-500/25'],'Approval pending':['checkc','Approval pending','bg-amber-500/10 text-amber-600 border-amber-500/25'],'Iteration':['swap','Iteration','bg-violet-500/10 text-violet-600 border-violet-500/25'],'To do':['dash','Yet to start','bg-slate-500/10 text-slate-600 border-slate-500/25'],'On hold':['pause','On hold','bg-orange-500/10 text-orange-600 border-orange-500/25'],'Done':['checkc','Completed','bg-green-500/10 text-green-600 border-green-500/25']};
const ProgressSlider=({value,onChange,onCommit,disabled,label='Progress'})=>{
 const ref=React.useRef(null);const start=React.useRef(value);const last=React.useRef(value);last.current=value;const [drag,setDrag]=React.useState(false);
 const col=value>=100?'#16a34a':value>=75?'#2563eb':value>=50?'#f59e0b':value>=25?'#f97316':'var(--destructive)';
 const cx=v=>`calc(22px + (100% - 44px) * ${v/100})`;
 const at=e=>{const r=ref.current.getBoundingClientRect();return Math.max(0,Math.min(100,Math.round(((e.clientX-r.left-22)/(r.width-44))*10)*10))};
 const step=(e,d)=>{e.preventDefault();const v=Math.max(0,Math.min(100,value+d));onChange(v);onCommit&&onCommit(v,value)};
 return <div className="select-none">
  <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground"><span>{label}</span><span className={cn('font-medium',tone(value).t)}>{value}%</span></div>
  <div ref={ref} role="slider" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} tabIndex={disabled?-1:0}
   onPointerDown={e=>{if(disabled)return;e.currentTarget.setPointerCapture(e.pointerId);start.current=value;setDrag(true);onChange(at(e))}}
   onPointerMove={e=>{if(drag&&!disabled)onChange(at(e))}} onPointerUp={()=>{if(drag){setDrag(false);onCommit&&onCommit(last.current,start.current)}}}
   onKeyDown={e=>{if(disabled)return;if(e.key==='ArrowRight'||e.key==='ArrowUp')step(e,10);if(e.key==='ArrowLeft'||e.key==='ArrowDown')step(e,-10)}}
   className={cn('relative h-12 w-full touch-none overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',disabled?'opacity-60':'cursor-pointer')}>
   <div className="absolute inset-y-0 left-0 rounded-xl" style={{width:`calc(22px + (100% - 44px) * ${value/100} + 20px)`,background:`linear-gradient(90deg, color-mix(in srgb, ${col} 4%, transparent), color-mix(in srgb, ${col} 30%, transparent))`}}/>
   {[0,10,20,30,40,50,60,70,80,90,100].map(v=>v!==value&&<span key={v} className="absolute top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/45 pointer-events-none" style={{left:cx(v)}}/>)}
   <div className={cn('absolute top-1 h-10 w-10 -translate-x-1/2 rounded-xl border border-border bg-background shadow-sm pointer-events-none',drag?'':'transition-[left] duration-150')} style={{left:cx(value)}}/>
  </div></div>};
const StatusBadge=({s,className,chev,noIcon})=>{const key=(s.st==='In progress'&&s.iter>0)?'Iteration':s.st;const [ic,label,cls]=SB[key]||SB['In progress'];return <Badge variant="outline" className={cn(cls,className)}>{!noIcon&&<Icon n={ic} c="h-3 w-3"/>}{key==='Iteration'?`Iteration ${s.iter+1}`:label}{chev&&<Icon n="down" c="h-3 w-3 opacity-70"/>}</Badge>};
const STATUS_OPTS=['To do','In progress','Input required','Review pending','Approval pending','On hold','Done'];
const StatusPicker=({s,onPick,disabled})=>disabled?<StatusBadge s={s}/>:<DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 cursor-pointer"><StatusBadge s={s} chev className="pr-1.5 hover:brightness-95 transition"/></button></DropdownMenuTrigger>
 <DropdownMenuContent align="start" className="w-48"><DropdownMenuLabel>Set status</DropdownMenuLabel><DropdownMenuSeparator/>{STATUS_OPTS.map(k=><DropdownMenuItem key={k} onSelect={()=>onPick(k)}><StatusBadge noIcon s={{st:k,iter:0}}/>{s.st===k&&<Icon n="check" c="ml-auto h-3.5 w-3.5"/>}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
const CommentBox=({onSend,placeholder='Comment…',label='Send'})=>{const [v,setV]=React.useState('');const go=()=>{if(v.trim()){onSend(v.trim());setV('')}};return <div className="flex gap-2 pt-2"><Input value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()} placeholder={placeholder}/><Button variant="secondary" onClick={go}>{label}</Button></div>};
const iso2=d=>new Date(d+'T00:00').toLocaleString('en',{month:'short',day:'numeric'});
/* Start screen approved 2026-09-29; yesterday-list redesigned on request (simpler, progressive disclosure). Snapshot: build/frozen/StartGate.jsx */
const StartGate=({stories,onStart})=>{
 const yest=stories.filter(s=>s.who==='Subash'&&['In progress','To do'].includes(s.st));
 const [mode,setMode]=React.useState('same');const [loc,setLoc]=React.useState('Office');
 const [sel,setSel]=React.useState(()=>Object.fromEntries(yest.map(s=>[s.k,{on:true,focus:s.focus||''}])));
 const [idx,setIdx]=React.useState(0);
 const [n,setN]=React.useState({title:'',start:'2026-09-29',ba:'',plan:''});const [lt,setLt]=React.useState('Annual');
 const chosen=yest.filter(s=>sel[s.k]?.on);
 const ok=mode==='same'?(chosen.length>0):mode==='new'?(n.title.trim().length>0&&!!n.start&&!!n.ba&&n.plan.trim().length>0):true;
 const opts=[['same','Same as yesterday','Keep working on unfinished stories','swap'],['new','Something new','Start a new task today','plus'],['leave','I’m on leave','Locks your updates for today','cal']];
 return <div className="max-w-2xl mx-auto space-y-6 py-4"><div><h1 className="text-2xl font-bold">Good morning, Subash</h1><p className="text-sm text-muted-foreground">Before you start — what are you working on today?</p></div>
  <RadioGroup value={mode} onValueChange={setMode} className="grid gap-3 sm:grid-cols-3">{opts.map(([k,t,d])=><label key={k} htmlFor={'mode-'+k} className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-4 shadow-xs"><RadioGroupItem id={'mode-'+k} value={k} className="mt-1"/><div className="space-y-1"><div className="text-base font-semibold leading-tight">{t}</div><div className="text-sm text-muted-foreground">{d}</div></div></label>)}</RadioGroup>
  {mode!=='leave'&&<Field label="Where are you working from?"><div><Segmented opts={['Office','Remote','Other']} value={loc} onChange={setLoc}/></div></Field>}
  {mode==='same'&&<div className="space-y-3"><div className="flex items-baseline gap-2"><span className="text-sm font-semibold">Yesterday</span><span className="text-sm text-muted-foreground">{yest.length}</span><span className="flex-1"/><span className="text-xs text-muted-foreground">{yest.filter(x=>sel[x.k]?.on).length} selected</span></div>
   <div className="space-y-3">{yest.map(s=>{const on=sel[s.k]?.on,m=META[s.k]||['','29 Sep'],ba=BA_OF[s.k]||'Priya',n=s.chk.filter(c=>c[1]).length,t=s.chk.length,p=t?n/t:0;
    return <div key={s.k} className={cn('rounded-xl bg-card p-5 border border-border shadow-sm transition-opacity',!on&&'opacity-60')}>
     <div className="flex items-start gap-3"><div className="flex-1 min-w-0"><div className="text-xs text-muted-foreground">Started {m[1]}</div>
      <div className="mt-1 text-base font-medium text-foreground">{s.t}</div>
      <div className="mt-1 text-[15px] leading-snug text-muted-foreground line-clamp-2">{m[0]}</div>
      <div className="mt-1.5 text-xs text-muted-foreground">Business analyst : {ba}</div>
</div>
      <Checkbox checked={on} onChange={v=>setSel({...sel,[s.k]:{...sel[s.k],on:v}})}/></div>
     <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground"><StatusBadge s={s}/>
      <span className="inline-flex items-center gap-1.5"><svg className="h-4 w-4 -rotate-90" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth="2.5"/><circle cx="10" cy="10" r="7.5" fill="none" className={tone(p*100).t} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${p*47.1} 47.1`}/></svg><span className={cn('font-medium',tone(p*100).t)}>{Math.round(p*100)}%</span></span></div></div>})}</div>
   {!yest.length&&<div className="text-sm text-muted-foreground">Nothing unfinished — choose “Something new”.</div>}</div>}
  {mode==='new'&&<Card><CardHeader><CardTitle>Today’s task</CardTitle><CardDesc>All fields are required.</CardDesc></CardHeader><CardContent className="space-y-3"><Field label="Task name *"><Input autoFocus value={n.title} onChange={e=>setN({...n,title:e.target.value})} placeholder="e.g. Notification preferences screen"/></Field>
   <div className="grid grid-cols-2 gap-3"><Field label="Start date *"><DatePicker value={n.start} onChange={v=>setN({...n,start:v})}/></Field><Field label="Under which BA *"><Select value={n.ba} onChange={e=>setN({...n,ba:e.target.value})}><option value="">Select BA…</option><option>Priya</option><option>Kiran</option></Select></Field></div>
   <Field label="Today’s plan *"><Input value={n.plan} onChange={e=>setN({...n,plan:e.target.value})} placeholder="What will you get done on this today?"/></Field></CardContent></Card>}
  {mode==='leave'&&<Card><CardContent className="p-4 space-y-3"><Alert icon="alert" title="Everything will be locked">While on leave you can’t edit stories, your plan or replies. Teammates see you as Away, and your Lead is notified.</Alert><Field label="Leave type"><Select value={lt} onChange={e=>setLt(e.target.value)}><option>Annual</option><option>Sick</option><option>Other</option></Select></Field></CardContent></Card>}
  <div className="flex justify-end"><Button disabled={!ok} onClick={()=>onStart(mode==='same'?{mode,loc,items:chosen.map(s=>({k:s.k,t:s.t,focus:sel[s.k].focus}))}:mode==='new'?{mode,loc,...n}:{mode,type:lt})}>{mode==='leave'?'Mark leave for today':'Start my day'}</Button></div></div>};
function App(){
 const [role,setRole]=useState('member');
 const [page,setPage]=useState('day');
 const [tab,setTab]=useState('attn');
 const [sel,setSel]=useState(null);
 const [stories,setStories]=useState(initStories);
 const [inbox,setInbox]=useState(initInbox);
 const [leave,setLeave]=useState([{id:1,who:'Chen',dates:'Oct 5–7',type:'Annual',state:'Approved'},{id:2,who:'Ben',dates:'Oct 9',type:'Annual',state:'Pending'}]);
 const [ci,setCi]=useState({done:false,started:false,mode:null,loc:'Office',note:'',plan:[]});
 const onLeave=ci.mode==='leave';
 const [dlg,setDlg]=useState(null);
 const [toast,setToast]=useState(null);
 const [filter,setFilter]=useState('all');
 const [q,setQ]=useState('');
 const [view,setView]=useState('list');
 const [showF,setShowF]=useState(false);
 const [coll,setColl]=useState({});
 const [log,setLog]=useState([{t:'Dia moved Icon set v2 to review',at:'1h ago'},{t:'Ben raised a blocker on DES-139',at:'2h ago'},{t:'Chen’s leave Oct 5–7 approved',at:'yesterday'}]);
 const [dismissed,setDismissed]=useState([]);
 const [conflictDone,setConflictDone]=useState(false);
 const [dayTab,setDayTab]=useState('track');const [qcOpen,setQcOpen]=useState(false);const [ed,setEd]=useState(null);const [cwI,setCwI]=useState(0);const [qcText,setQcText]=useState('');const [editK,setEditK]=useState(null);
 const [mailSel,setMailSel]=useState(null);
 const [readIds,setReadIds]=useState([]);
 const [hm,setHm]=useState(8);
 const [hd,setHd]=useState('2026-09-29');
 const lead=role==='lead';
 const say=m=>{if(!/not in prototype|Switch|Starred|Settings|Help Center|New message|Invite|Snoozed/i.test(m))setLog(l=>[{t:m,at:'just now'},...l].slice(0,10));setToast(m);clearTimeout(window._t);window._t=setTimeout(()=>setToast(null),2200)};
 const ev=(k,t,c)=>upd(k,x=>({events:[{t,c,by:lead?'Ravi':'Subash',at:'just now'},...(x.events||[])]}));
 const people=TEAM.map(p=>p.n==='Subash'?{...p,loc:onLeave?null:ci.loc,confirmed:ci.started,note:onLeave?'On leave':ci.note,av:onLeave?'Away':(ci.note?'Partial':'Available'),plan:onLeave?[]:ci.plan}:{...p,confirmed:p.n!=='Dia'});
 const upd=(k,f)=>setStories(s=>s.map(x=>x.k===k?{...x,...(typeof f==='function'?f(x):f)}:x));
 const nav=lead?[['team','Team','users'],['stories','Stories','list'],['leave','Leave & Calendar','cal'],['inbox','Inbox','inbox']]:[['day','My Day','home'],['team','Team','users'],['stories','Stories','list'],['leave','Leave & Calendar','cal'],['inbox','Inbox','inbox']];
 const myInbox=inbox.filter(i=>!!i.lead===lead);
 const go=(p,t)=>{setPage(p);setSel(null);if(t)setTab(t)};
 const switchRole=r=>{setRole(r);setPage(r==='lead'?'team':'day');setSel(null)};
 let attn=[];
 stories.forEach(s=>{
  if(s.blocker)attn.push({g:'Blockers',t:`${s.k} · ${s.t}`,d:`${s.who} is waiting on ${s.blocker.on}${s.blocker.ack?' · acknowledged':''}`,b:s.blocker.ack?'Resolve':'Acknowledge',f:()=>s.blocker.ack?resolve(s.k):(upd(s.k,{blocker:{...s.blocker,ack:true}}),ev(s.k,'Blocker acknowledged'),say('Blocker acknowledged'))});
  if(s.st==='Approval pending')attn.push({g:'Reviews waiting',t:`${s.k} · ${s.t}`,d:`${s.who} · ${s.est}d estimate`,b:'Comment',f:()=>setDlg({type:'review',k:s.k})});
  if(s.overdue&&s.st!=='Done')attn.push({g:'Overdue',t:`${s.k} · ${s.t}`,d:`${s.who} · due ${s.due} (baseline ${s.base})`,b:'Open',f:()=>setSel(s.k)});
  if(s.risk)attn.push({g:'At risk',t:`${s.k} · ${s.t}`,d:`${s.who} flagged: “${s.risk}”`,b:'Open',f:()=>setSel(s.k)});
 });
 leave.filter(l=>l.state==='Pending').forEach(l=>attn.push({g:'Leave requests',t:`${l.who} · ${l.dates}`,d:'Conflict: DES-139 is due Oct 3',b:'Review',f:()=>go('leave')}));
 if(!conflictDone)attn.push({g:'Leave conflicts',t:'Chen · Oct 5–7',d:'DES-153 needs 3d but only 1d available before Oct 8',b:'Resolve',f:()=>setDlg({type:'conflict'})});
 attn=attn.map(a=>({...a,id:a.g+a.t}));
 const snoozed=attn.filter(a=>dismissed.includes(a.id)).length;
 attn=attn.filter(a=>!dismissed.includes(a.id));
 const resolve=k=>{upd(k,{blocker:null});ev(k,'Blocker resolved');say('Blocker resolved')};
 const addReview=(k,text)=>{upd(k,x=>({reviews:[...(x.reviews||[]),{id:Date.now(),by:'Ravi',role:'Lead',text,at:'just now',replies:[]}]}));say('Review comment posted on '+k)};
 const addReply=(k,id,text)=>{upd(k,x=>({reviews:x.reviews.map(r=>r.id===id?{...r,replies:[...r.replies,{by:'Subash',text,at:'just now'}]}:r)}));say('Reply posted on '+k)};
 const start=p=>{
  if(p.mode==='same'){setStories(st=>st.map(x=>{const i=p.items.find(y=>y.k===x.k);return i?{...x,focus:i.focus}:x}));setCi({...ci,started:true,done:true,mode:'same',loc:p.loc,plan:p.items.map(i=>i.t)});say('Continuing yesterday’s work · focus saved')}
  if(p.mode==='new'){const k='DES-'+(160+stories.length),dd=new Date(p.start+'T00:00'),fs=`${dd.getDate()} ${dd.toLocaleString('en',{month:'short'})}`;META[k]=['New task',fs,'Medium',0,0];BA_OF[k]=p.ba;setStories(st=>[{k,t:p.title,who:'Subash',st:'In progress',due:'TBD',base:'TBD',est:1,chk:[],focus:p.plan,reviews:[],iter:0},...st]);setCi({...ci,started:true,done:true,mode:'new',loc:p.loc,plan:[p.title]});say(k+' created under BA '+p.ba)}
  if(p.mode==='leave'){setCi({...ci,started:true,done:true,mode:'leave',plan:[]});setLeave(l=>[...l,{id:Date.now(),who:'Subash',dates:'Sep 29',type:p.type,state:'Pending'}]);setInbox(i=>[{id:Date.now()+1,lead:1,lvl:'Important',t:'Subash is on leave today',d:p.type+' · same-day, pending approval',act:'Review',to:['leave']},...i]);say('Leave marked for today · updates are locked')}
 };
 const crumbs=[nav.find(n=>n[0]===page)?.[1]]; if(sel)crumbs.push(sel);

 /* ---------- views ---------- */
 const StoryRow=({s})=>{const d=s.chk.filter(c=>c[1]).length;return(
  <button onClick={()=>setSel(s.k)} className="w-full text-left flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-accent transition-colors">
   <span className="w-16 text-xs text-muted-foreground font-mono">{s.k}</span>
   <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{s.t}</div>
    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 mt-0.5"><span>{s.who}</span><span>·</span><span>Due {s.due}</span><span>·</span><span>{s.est}d</span>{s.chk.length>0&&<><span>·</span><span>{d} of {s.chk.length}</span></>}</div></div>
   <div className="hidden sm:flex gap-1.5 flex-wrap justify-end">
    {s.blocker&&<Badge variant="destructive"><Icon n="ban" c="h-3 w-3"/>Blocked</Badge>}
    {s.risk&&<Badge variant="warn"><Icon n="alert" c="h-3 w-3"/>At risk</Badge>}
    {s.iter>0&&<Badge variant="outline">Iteration {s.iter+1}</Badge>}{s.moved&&<Badge variant="outline">Date moved</Badge>}
    <StatusBadge s={s}/></div>
   <Icon n="chev" c="h-4 w-4 text-muted-foreground"/></button>)};

 const vDay=()=>{const mine=stories.filter(s=>s.who==='Subash');
  const todayEntries=onLeave?[{leave:'On leave'}]:ci.plan.map(t=>{const s=stories.find(x=>x.t===t);return s?{k:s.k,t:s.t,note:s.focus||'No focus written',loc:ci.loc}:null}).filter(Boolean);
  const entriesFor=k=>k==='2026-09-29'?todayEntries:(HIST[k]||[]);
  const TG=[['all','']];
  const prog=s=>{const n=s.chk.filter(c=>c[1]).length,t=s.chk.length;return s.pct!=null&&s.st!=='Done'?{n,t,p:s.pct}:t?{n,t,p:n/t*100}:null};
  const barC=p=>p>=75?'bg-muted':p>=40?'bg-muted':'bg-destructive/10';

  const took=s=>{const sm=(META[s.k]||[])[1];const a=sm?new Date(sm+' 2026'):null;if(!a||isNaN(a))return '—';const d=Math.round((new Date(s.doneOn+'T00:00')-a)/864e5);return d<=0?'Same day':d===1?'1 day':d+' days'};
  const monday=d=>{const x=new Date(d+'T00:00');x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
  const fmt=(d,o)=>d.toLocaleString('en',o);
  const doneAll=mine.filter(s=>s.st==='Done'&&s.doneOn).sort((a,b)=>b.doneOn.localeCompare(a.doneOn));
  const weeks=[];doneAll.forEach(s=>{const m=monday(s.doneOn),k=dkey(m);let w=weeks.find(x=>x.k===k);if(!w){w={k,m,items:[]};weeks.push(w)}w.items.push(s)});
  const pastWorks=<div className="space-y-8">{weeks.map(w=>{const e=new Date(w.m);e.setDate(e.getDate()+6);const cur=w.k===dkey(monday('2026-09-29'));return(
   <div key={w.k} className="space-y-3"><div className="flex items-baseline gap-2"><span className="text-sm font-semibold">{w.m.getDate()}{w.m.getMonth()!==e.getMonth()?' '+fmt(w.m,{month:'short'}):''} – {e.getDate()} {fmt(e,{month:'short'})}</span>{cur&&<span className="text-xs text-muted-foreground">This week</span>}<span className="text-sm text-muted-foreground">{w.items.length}</span></div>
   <div className="grid gap-3 md:grid-cols-2">{w.items.map(s=>{const m=META[s.k]||['',''],ba=BA_OF[s.k]||'Priya',p=s.pct??100,dd=new Date(s.doneOn+'T00:00'),commit=el=>{const v=Math.max(0,Math.min(100,Math.round(+el.value)));if(isNaN(v)||v===p){el.value=p;return}if(v<100){upd(s.k,{st:'In progress',pct:v});say(s.k+' reopened at '+v+'% — moved back to In progress')}else upd(s.k,{pct:v})};
    return <div key={s.k} className="rounded-xl bg-card p-5 border border-border shadow-sm"><div className="flex items-start gap-3"><div className="flex-1 min-w-0">
     <div className="text-xs text-muted-foreground">{fmt(dd,{weekday:'short'})}, {dd.getDate()} {fmt(dd,{month:'short'})}</div>
     <div className="mt-1 text-base font-medium text-foreground">{s.t}</div>
     <div className="mt-1 text-[15px] leading-snug text-muted-foreground line-clamp-2">{m[0]}</div>
     <div className="mt-1.5 text-xs text-muted-foreground">Business analyst : {ba}</div>
     <div className="mt-0.5 text-xs text-muted-foreground">Worked by : {(s.team||[s.who]).join(', ')}</div>
     <div className="mt-0.5 text-xs text-muted-foreground">Took : {took(s)}</div></div>
</div>
     <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground"><StatusBadge s={s}/>{s.proto&&<a href={s.proto} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-muted-foreground/60 hover:text-foreground transition-colors"><Icon n="link" c="h-3.5 w-3.5"/>Prototype</a>}<span className="flex-1"/>{!onLeave&&<Button size="sm" variant="ghost" onClick={()=>setEd({k:s.k,t:s.t,d:m[0],ba,past:true,proto:s.proto||'',start:dkey(new Date((m[1]||'1 Sep')+' 2026')),end:s.doneOn})}><Icon n="edit" c="h-3.5 w-3.5"/>Edit</Button>}</div></div>})}</div></div>)})}
   {!weeks.length&&<div className="text-sm text-muted-foreground">No past works yet.</div>}</div>;
  const addQc=()=>{const v=qcText.trim();if(!v)return;const k='DES-'+(160+stories.length);setStories(s=>[{k,t:v,who:'Subash',st:'In progress',due:'Sep 29',base:'Sep 29',est:.5,chk:[],reviews:[],iter:0},...s]);setCi(c=>({...c,plan:[...c.plan,v]}));setQcText('');setQcOpen(false);say(`${k} created and added to today`)};
  const saveEd=()=>{const m=META[ed.k]||['','29 Sep','Medium',0,0];META[ed.k]=[ed.d,...m.slice(1)];BA_OF[ed.k]=ed.ba;if(ed.past){const sd=new Date(ed.start+'T00:00');META[ed.k]=[ed.d,sd.getDate()+' '+sd.toLocaleString('en',{month:'short'}),...m.slice(2)];upd(ed.k,{t:ed.t.trim(),proto:ed.proto.trim(),doneOn:ed.end});setEd(null);say(ed.k+' updated');return}upd(ed.k,{t:ed.t.trim()});setEd(null);say(ed.k+' updated')};
  const edOk=()=>{if(!ed||!ed.t.trim()||!ed.d.trim()||!ed.ba)return false;if(ed.past&&(!/^https?:\/\/\S+\.\S+/.test(ed.proto.trim())||!ed.start||!ed.end||ed.end<ed.start))return false;return true};
  const delEd=()=>{const s0=stories.find(x=>x.k===ed.k);setStories(s=>s.filter(x=>x.k!==ed.k));if(s0)setCi(c=>({...c,plan:c.plan.filter(n=>n!==s0.t)}));say(ed.k+' deleted');setEd(null)};
  const active=mine.filter(s=>s.st!=='Done');
  const tracker=<div className="space-y-3">{active.length?<div className="grid gap-3 md:grid-cols-2">{active.map(s=>{const m=META[s.k]||['New story','29 Sep','Medium',0,0],ba=BA_OF[s.k]||'Priya',pg=prog(s),P=pg?pg.p:0;
   return <div key={s.k} className="rounded-xl bg-card p-5 border border-border shadow-sm"><div className="flex items-start gap-3"><div className="flex-1 min-w-0">
    <div className="text-xs text-muted-foreground">Started {m[1]}</div>
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-base font-medium text-foreground cursor-pointer hover:underline" onClick={()=>setSel(s.k)}>{s.t}</span><StatusPicker s={s} disabled={onLeave} onPick={k=>{if(k===s.st)return;if(k==='Done'){setDlg({type:'complete',k:s.k});return}upd(s.k,{st:k,statusNote:'',...(k==='To do'?{pct:0}:(k==='In progress'&&Math.round(P)===0)?{pct:5}:{})});say(s.k+' → '+(SB[k]?.[1]||k))}}/></div>
    <div className="mt-1 text-[15px] leading-snug text-muted-foreground line-clamp-2">{(s.focus||'').trim()||m[0]}</div>
    
    {s.blocker&&<div className="mt-1 text-xs text-destructive">Blocked · {s.blocker.on}</div>}
    <div className="mt-1.5 text-xs text-muted-foreground">Business analyst : {ba}</div></div><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="size-8 shrink-0" disabled={onLeave} aria-label="Task actions"><IconDotsVertical className="h-4 w-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-36"><DropdownMenuItem onSelect={()=>setEd({k:s.k,t:s.t,d:m[0],ba})}><Icon n="edit" c="h-4 w-4"/>Edit</DropdownMenuItem><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={()=>setEd({k:s.k,t:s.t,d:m[0],ba,del:true})}><Icon n="trash" c="h-4 w-4"/>Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </div>
    <div className="mt-4"><ProgressSlider value={Math.round(P)} disabled={onLeave} onChange={v=>upd(s.k,{pct:v,...(v===0?{st:'To do'}:(v<100&&s.st==='To do')?{st:'In progress'}:{})})} onCommit={(v,from)=>{if(v===100)setDlg({type:'complete',k:s.k,prev:from})}}/></div>
    
    <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">{s.proto?<a href={s.proto} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-muted-foreground/60 hover:text-foreground transition-colors"><Icon n="link" c="h-3.5 w-3.5"/>Prototype</a>:<span className="text-xs text-muted-foreground/60">Prototype needed at completion</span>}</div></div>})}</div>
   :<div className="text-sm text-muted-foreground">No active tasks.</div>}</div>;
  const selE=entriesFor(hd);
  const parse=k=>new Date(k+'T00:00');
  const allKeys=[...Object.keys(HIST),'2026-09-29'];
  const withWork=allKeys.filter(k=>entriesFor(k).some(x=>!x.leave)).map(parse);
  const leaveDays=allKeys.filter(k=>entriesFor(k).some(x=>x.leave)).map(parse);
  const history=<div className="grid gap-4 lg:grid-cols-[auto_1fr] items-start"><Card className="w-fit"><CardContent className="p-3">
   <Calendar mode="single" selected={parse(hd)} onSelect={d=>{if(d){setHd(dkey(d));setHm(d.getMonth())}}} month={new Date(2026,hm,1)} onMonthChange={m=>setHm(m.getMonth())} startMonth={new Date(2026,7,1)} endMonth={new Date(2026,9,31)} modifiers={{work:withWork,leave:leaveDays}} modifiersClassNames={{work:'font-semibold',leave:'text-muted-foreground line-through'}} className="p-0 [--cell-size:--spacing(10)]"/></CardContent></Card>
   <Card><CardHeader><CardTitle>{parse(hd).toLocaleString('en',{weekday:'long',day:'numeric',month:'short'})}</CardTitle><CardDesc>{hd==='2026-09-29'?'Today':selE.length?'Recorded':'No record'}</CardDesc></CardHeader><CardContent className="space-y-3">
    {!selE.length&&<div className="text-sm text-muted-foreground">Nothing recorded for this day.</div>}
    {selE.map((x,i)=>x.leave?<Alert key={i} variant="warn" icon="cal" title={x.leave}>Updates were locked.</Alert>:<div key={i} className="space-y-1 rounded-lg border border-border p-3"><div className="flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{x.k}</span>{x.loc&&<Badge variant="outline"><Icon n="pin" c="h-3 w-3"/>{x.loc}</Badge>}</div><div className="text-sm font-medium">{x.t}</div><div className="text-xs text-muted-foreground">{x.note}</div></div>)}</CardContent></Card></div>;
  return(<div className="space-y-6">
  <div className="flex flex-wrap items-center gap-x-6 gap-y-4"><div className="min-w-[220px] flex-1">
  <Head title="Good morning, Subash" sub={`Tuesday 29 September${onLeave?' · On leave':''}`}/></div><div className="w-full sm:w-[440px] sm:max-w-full">
  {onLeave?<Alert variant="warn" icon="cal" title="You’re on leave today">Your stories, plan and replies are locked so nothing changes while you’re away. <Button size="sm" variant="outline" className="ml-2" onClick={()=>setCi(c=>({...c,mode:'same',started:false}))}>I’m back · cancel leave</Button></Alert>
  :<div className="flex items-stretch gap-4 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
   <div className="min-w-0 flex-1 self-center"><div className="flex items-center gap-2 text-sm font-semibold"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500/60"/><span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"/></span>Checked in</div><div className="mt-0.5 truncate text-xs text-muted-foreground">{ci.mode==='new'?'New task today':'Continuing yesterday’s work'}</div></div>
   <div className="w-px bg-border"/>
   <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="-my-1 -mr-2 rounded-lg px-2 py-1 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"><div className="text-xs text-muted-foreground">Working from</div><div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold"><Icon n="pin" c="h-3.5 w-3.5 text-muted-foreground"/>{ci.loc}<Icon n="down" c="h-3.5 w-3.5 text-muted-foreground"/></div></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-40"><DropdownMenuLabel>Working from</DropdownMenuLabel><DropdownMenuSeparator/>{['Office','Remote','Other'].map(l=><DropdownMenuItem key={l} onSelect={()=>{setCi(c=>({...c,loc:l}));say('Location set to '+l)}}>{l}{ci.loc===l&&<Icon n="check" c="ml-auto h-3.5 w-3.5"/>}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div>}</div></div>
  <div className="grid gap-3 sm:grid-cols-3">
   {(()=>{const cur=mine.filter(s=>s.st!=='Done'&&s.st!=='To do'),n=cur.length,i=Math.min(cwI,Math.max(0,n-1)),s=cur[i];
    return <Card className="@container/card bg-linear-to-t from-primary/5 to-card shadow-xs"><CardHeader className="pb-0"><div className="flex h-7 items-center gap-2"><CardDesc className="text-sm whitespace-nowrap">Currently working</CardDesc><span className="flex-1"/>{n>0&&<div className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground"><Button size="icon" variant="outline" className="size-7" disabled={n<2} aria-label="Previous task" onClick={()=>setCwI((i-1+n)%n)}><IconChevronLeft className="size-4"/></Button><span className="tabular-nums px-0.5">{i+1} / {n}</span><Button size="icon" variant="outline" className="size-7" disabled={n<2} aria-label="Next task" onClick={()=>setCwI((i+1)%n)}><IconChevronRight className="size-4"/></Button></div>}</div>{!n&&<CardTitle className="text-lg font-semibold leading-tight">Nothing in progress</CardTitle>}</CardHeader>
     <CardContent className="pt-1 text-sm text-muted-foreground">{s?(()=>{const m=META[s.k]||['','29 Sep'],pg=prog(s),P=pg?Math.round(pg.p):0;return <div key={s.k}><div className="text-lg font-semibold leading-tight text-foreground">{s.t}</div><div className="mt-0.5">Business analyst : {BA_OF[s.k]||'Priya'} · Started {m[1]}</div><div className="mt-2 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full',tone(P).b)} style={{width:P+'%'}}/></div><span className={cn('text-xs font-medium tabular-nums',tone(P).t)}>{P}%</span></div></div>})():'Set a task to In progress to see it here'}</CardContent></Card>})()}
   <Stat title="In my queue" n={mine.filter(s=>s.st!=='Done').length} d="tasks still open"/>
   <Stat green title="Completed" n={mine.filter(s=>s.st==='Done').length} d={<><span className="font-medium text-green-600">{mine.filter(s=>s.st==='Done'&&(s.doneOn||'').startsWith('2026-09')).length}</span> this month</>}/></div>
  <div className="flex items-center justify-between gap-3"><Tabs value={dayTab} onChange={setDayTab} tabs={[['track','Task tracker',mine.filter(s=>s.st!=='Done').length],['history','Past works']]}/>
   <Button disabled={onLeave} onClick={()=>setQcOpen(true)}><Icon n="plus" c="h-4 w-4"/>Quick capture</Button></div>
    <Dialog open={!!ed} onClose={()=>setEd(null)} title={ed?(ed.del?'Delete task?':`Edit · ${ed.k}`):''} desc={ed?.del?'This can’t be undone.':'Update the task details.'} footer={ed?.del?<><Button variant="outline" onClick={()=>setEd(null)}>Cancel</Button><Button variant="destructive" onClick={delEd}>Delete task</Button></>:<><Button variant="outline" onClick={()=>setEd(null)}>Cancel</Button><Button disabled={!edOk()} onClick={saveEd}>Save changes</Button></>}>{ed&&(ed.del?<div className="text-sm">“{ed.t}” will be removed from your task tracker and today’s plan.</div>:<div className="space-y-3"><Field label="Task name *"><Input autoFocus aria-invalid={!ed.t.trim()} value={ed.t} onChange={e=>setEd({...ed,t:e.target.value})}/>{!ed.t.trim()&&<div className="text-xs text-destructive">Task name is required.</div>}</Field><Field label="Description *"><Textarea rows={3} aria-invalid={!ed.d.trim()} value={ed.d} onChange={e=>setEd({...ed,d:e.target.value})}/>{!ed.d.trim()&&<div className="text-xs text-destructive">Description is required.</div>}</Field><Field label="Business analyst *"><Select value={ed.ba} onChange={e=>setEd({...ed,ba:e.target.value})}><option>Priya</option><option>Kiran</option></Select></Field>{ed.past&&<><div className="grid grid-cols-2 gap-3"><Field label="Start date *"><DatePicker value={ed.start} onChange={v=>setEd({...ed,start:v})}/></Field><Field label="Completed on *"><DatePicker value={ed.end} onChange={v=>setEd({...ed,end:v})}/></Field></div>{(!ed.start||!ed.end)&&<div className="text-xs text-destructive">Both dates are required.</div>}{ed.start&&ed.end&&ed.end<ed.start&&<div className="text-xs text-destructive">Completed date can’t be before the start date.</div>}<Field label="Prototype link *"><Input aria-invalid={!ed.proto.trim()} value={ed.proto} onChange={e=>setEd({...ed,proto:e.target.value})} placeholder="https://figma.com/proto/…"/>{!ed.proto.trim()&&<div className="text-xs text-destructive">Prototype link is required.</div>}</Field>{ed.proto&&!/^https?:\/\/\S+\.\S+/.test(ed.proto.trim())&&<div className="text-xs text-destructive">Enter a full link starting with http(s)://</div>}</>}</div>)}</Dialog>
  <Dialog open={qcOpen} onClose={()=>setQcOpen(false)} title="Quick capture" desc="Log unplanned work — it’s added to today’s plan." footer={<Button disabled={!qcText.trim()} onClick={addQc}>Add to today</Button>}><Field label="Task name *"><Input autoFocus value={qcText} onChange={e=>setQcText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addQc()}} placeholder="What came up?"/></Field></Dialog>
  {dayTab==='track'?tracker:pastWorks}</div>)};

 const QuickAdd=()=>{const [v,setV]=useState('');return <div className="relative"><Icon n="plus" c="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input disabled={onLeave} className="pl-9" placeholder={onLeave?'Locked while on leave':'Quick capture unplanned work — press Enter'} value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&v.trim()){const k='DES-'+(160+stories.length);setStories(s=>[{k,t:v,who:'Subash',st:'In progress',due:'Sep 29',base:'Sep 29',est:.5,chk:[],reviews:[],iter:0},...s]);setCi(c=>({...c,plan:[...c.plan,v]}));setV('');say(`${k} created and added to today`)}}}/></div>};

 const SEV={'Blockers':['border-l-destructive','ban','text-destructive'],'Leave conflicts':['border-l-destructive','alert','text-destructive'],'Leave requests':['border-l-muted-foreground','cal','text-foreground'],'Reviews waiting':['border-l-muted-foreground','eye','text-muted-foreground'],'Overdue':['border-l-muted-foreground','clock','text-foreground'],'At risk':['border-l-muted-foreground','alert','text-foreground']};
 const vTeam=()=>{
  const inN=people.filter(p=>p.av!=='Away').length, blockedN=stories.filter(s=>s.blocker).length, revN=stories.filter(s=>s.st==='Approval pending').length;
  const groups=Object.keys(SEV).filter(g=>attn.some(a=>a.g===g));
  const sig=p=>({bl:stories.filter(s=>s.who===p.n&&s.blocker).length,od:stories.filter(s=>s.who===p.n&&s.overdue).length});
  const avBadge=p=><Badge variant={p.av==='Available'?'ok':p.av==='Partial'?'warn':'outline'}>{p.av}</Badge>;
  const locCell=p=>p.av==='Away'?<span className="text-muted-foreground">—</span>:<span className="inline-flex items-center gap-1"><Icon n="pin" c="h-3 w-3 text-muted-foreground"/>{p.loc}{!p.confirmed&&<span className="text-xs text-muted-foreground italic ml-1">usual · not confirmed</span>}</span>;
  return(<div className="space-y-6"><Head title="Team" sub={lead?'Who is in, and what needs you':'Who is around today'}/>
  {lead&&<div className="grid gap-3 grid-cols-2 lg:grid-cols-4"><Stat title="In today" n={`${inN} / ${people.length}`} d={`${people.length-inN} away`}/><Stat title="Needs attention" n={attn.length} d="open signals"/><Stat title="Blocked" n={blockedN} d="stories waiting on someone"/><Stat title="Awaiting review" n={revN} d="Lead or Manager"/></div>}
  {lead&&<Tabs value={tab} onChange={setTab} tabs={[['attn','Attention',attn.length],['today','Today'],['load','Workload']]}/>}
  {!lead&&<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{people.map(p=><Card key={p.n} className="cursor-pointer hover:bg-accent/40 transition-colors" onClick={()=>{setPage('stories');setSel(null);setQ(p.n)}}><CardContent className="p-4 space-y-3">
    <div className="flex items-center gap-3"><Avatar name={p.n}/><div className="flex-1"><div className="text-sm font-medium leading-none">{p.n}</div><div className="text-xs mt-1">{locCell(p)}</div></div>{avBadge(p)}</div>
    {p.note&&p.av!=='Away'&&<div className="text-xs text-muted-foreground flex items-center gap-1"><Icon n="clock" c="h-3 w-3"/>{p.note}</div>}
    <Separator/><ul className="space-y-1 text-sm">{p.plan.map(x=><li key={x}>• {x}</li>)}{!p.plan.length&&<li className="text-xs text-muted-foreground">Nothing planned</li>}</ul><div className="text-xs text-primary">View work · read only →</div></CardContent></Card>)}</div>}
  {lead&&tab==='today'&&<Card className="overflow-x-auto"><Table className="w-full text-[13px] min-w-[820px]"><TableHeader><TableRow className="bg-muted/40 text-xs text-muted-foreground">{['Person','Availability','Location','Today’s plan','Signals','Load (10d)'].map(h=><TableHead key={h} className="px-4 py-2.5">{h}</TableHead>)}</TableRow></TableHeader><TableBody>
   {people.map(p=>{const {bl,od}=sig(p);return <TableRow key={p.n} className="border-t border-border hover:bg-accent/50"><TableCell className="px-4 py-3"><div className="flex items-center gap-2.5"><Avatar name={p.n} c="h-7 w-7"/><span className="font-medium">{p.n}</span></div></TableCell>
    <TableCell className="px-4 py-3"><div className="space-y-1">{avBadge(p)}{p.note&&<div className="text-xs text-muted-foreground">{p.note}</div>}</div></TableCell><TableCell className="px-4 py-3">{locCell(p)}</TableCell>
    <TableCell className="px-4 py-3"><div className="flex gap-1 flex-wrap max-w-[260px]">{p.plan.map(x=><Badge key={x} variant="outline">{x}</Badge>)}{!p.plan.length&&<span className="text-muted-foreground text-xs">—</span>}</div></TableCell>
    <TableCell className="px-4 py-3"><div className="flex gap-1.5">{bl>0&&<Badge variant="destructive">{bl} blocked</Badge>}{od>0&&<Badge variant="warn">{od} overdue</Badge>}{!bl&&!od&&<span className="text-xs text-muted-foreground">Clear</span>}</div></TableCell>
    <TableCell className="px-4 py-3 w-40"><Progress value={p.load[0]/p.load[1]*100} over={p.load[0]/p.load[1]>.85}/><div className="text-xs text-muted-foreground mt-1">{p.load[0]}d of {p.load[1]}d</div></TableCell></TableRow>})}</TableBody></Table></Card>}
  {lead&&tab==='attn'&&<div className="grid gap-6 lg:grid-cols-[1fr_290px] items-start"><div className="space-y-5">
    {!groups.length&&<Empty>All clear — nothing needs you right now 🎉</Empty>}
    {groups.map(g=><Sec key={g} title={g} count={attn.filter(a=>a.g===g).length}>{attn.filter(a=>a.g===g).map(a=>
     <div key={a.id} className={cn('flex items-center gap-3 rounded-xl border border-border border-l-4 bg-card p-3',SEV[g][0])}><Icon n={SEV[g][1]} c={cn('h-4 w-4',SEV[g][2])}/><div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{a.t}</div><div className="text-xs text-muted-foreground">{a.d}</div></div><Button size="sm" variant="ghost" onClick={()=>{setDismissed(d=>[...d,a.id]);say('Snoozed until tomorrow')}}>Snooze</Button><Button size="sm" onClick={a.f}>{a.b}</Button></div>)}</Sec>)}
    {snoozed>0&&<Button variant="link" size="sm" className="h-auto p-0 text-muted-foreground" onClick={()=>setDismissed([])}>{snoozed} snoozed · show again</Button>}</div>
   <Card><CardHeader><CardTitle>Since you last looked</CardTitle></CardHeader><CardContent><ol className="space-y-3 border-l border-border ml-1.5">{log.map((l,i)=><li key={i} className="pl-4 relative"><span className="absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full bg-primary/60"/><div className="text-sm">{l.t}</div><div className="text-xs text-muted-foreground">{l.at}</div></li>)}</ol></CardContent></Card></div>}
  {lead&&tab==='load'&&<Card><CardHeader><CardTitle>Committed vs available days</CardTitle><CardDesc>Next 10 working days</CardDesc></CardHeader><CardContent className="space-y-4">{people.map(p=><div key={p.n} className="flex items-center gap-3"><Avatar name={p.n} c="h-7 w-7"/><span className="w-14 text-sm">{p.n}</span><div className="flex-1"><Progress value={p.load[0]/p.load[1]*100} over={p.load[0]/p.load[1]>.85}/></div><span className="w-16 text-right text-xs text-muted-foreground">{p.load[0]}d / {p.load[1]}d</span></div>)}</CardContent></Card>}
 </div>)};

 const COLORS=['bg-muted','bg-muted','bg-muted','bg-muted','bg-muted'];
 const AvStack=({names})=><div className="flex -space-x-2">{names.map(n=><div key={n} className={cn('h-6 w-6 rounded-full grid place-items-center text-[10px] font-semibold ring-2 ring-white text-foreground','bg-muted')}>{n[0]}</div>)}</div>;
 const Pri=({p})=><span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',PRI[p][0])}><Icon n="flag" c="h-3 w-3"/>{p}</span>;
 const Chip=({icon,n})=><Badge variant="secondary"><Icon n={icon} c="h-3 w-3"/>{n}</Badge>;
 const vStories=()=>{
  const list=stories.filter(s=>(filter==='all'||(filter==='blocked'&&s.blocker)||(filter==='overdue'&&s.overdue)||(filter==='mine'&&s.who===(lead?'Ravi':'Subash')))&&(s.t+s.k+s.who).toLowerCase().includes(q.toLowerCase()));
  const m=s=>META[s.k]||['New story','29 Sep','Medium',0,0];
  const cols=[['Story','sun'],['Description','list'],['Assignee','users'],['Start','cal'],['Due date','cal'],['Priority','flag'],['Checklist','check'],['Prototype','link'],['Chat','msg']];
  return(<div className="-m-6">
   <div className="px-6 pt-5 pb-3 space-y-1"><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center"><Icon n="list" c="h-5 w-5"/></div><h1 className="text-2xl font-bold flex-1">Team Stories</h1>
     <AvStack names={['Subash','Ben','Chen','Dia','Ravi']}/><Button variant="outline" size="sm" onClick={()=>say('Invite link copied')}><Icon n="user" c="h-3.5 w-3.5"/>Invite</Button></div>
    <p className="text-sm text-muted-foreground">Monitor all of your team’s stories here.</p></div>
   <div className="px-6 flex flex-wrap items-center gap-3 border-b border-border">
    <div className="flex-1 py-2"><Tabs value={view} onChange={setView} tabs={[['kanban','Kanban'],['list','List'],['calendar','Calendar']]}/></div>
    <div className="relative w-56"><Icon n="search" c="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground"/><Input className="h-9 pl-8 pr-12" placeholder="Search" value={q} onChange={e=>setQ(e.target.value)}/><kbd className="absolute right-2 top-2 rounded border border-border bg-muted px-1.5 text-[10px] text-muted-foreground">⌘K</kbd></div>
    <Button variant="outline" onClick={()=>setShowF(!showF)}><Icon n="filter"/>Filter</Button>
    <Button disabled={!lead&&onLeave} onClick={()=>setDlg({type:'new'})}><Icon n="plus"/>Create Story</Button></div>
   {showF&&<div className="px-6 pt-3 flex gap-2 flex-wrap"><ToggleGroup type="single" variant="outline" size="sm" value={filter} onValueChange={v=>v&&setFilter(v)}>{[['all','All'],['mine','Mine'],['blocked','Blocked'],['overdue','Overdue']].map(([k,l])=><ToggleGroupItem key={k} value={k}>{l}</ToggleGroupItem>)}</ToggleGroup></div>}
   <div className="p-5 space-y-4 bg-muted/30">
   {view==='list'&&GROUPS.map(([st,label,bgc,tc,pill,gi])=>{const rows=list.filter(s=>s.st===st);const open=!coll[st];return(
    <div key={st} className="rounded-xl border border-border bg-card p-2 space-y-2">
     <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2',bgc)}><Button variant="ghost" size="icon" className="size-7" onClick={()=>setColl({...coll,[st]:open})}><Icon n={open?'down':'chev'}/></Button><Icon n={gi} c={cn('h-4 w-4',tc)}/><span className="text-sm font-semibold">{label}</span><span className={cn('rounded px-1.5 text-xs font-medium',pill,tc)}>{rows.length}</span><span className="flex-1"/><Button variant="ghost" size="icon" className="size-7" onClick={()=>setDlg({type:'new'})}><Icon n="plus"/></Button></div>
     {open&&<div className="overflow-x-auto"><Table className="w-full text-[13px] border-collapse min-w-[900px]"><TableHeader><TableRow className="bg-muted/40">{cols.map(([c,ic])=><TableHead key={c} className="px-3 py-2 whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><Icon n={ic} c="h-3.5 w-3.5"/>{c}</span></TableHead>)}<TableHead className="w-10"/></TableRow></TableHeader><TableBody>
      {rows.map(s=><TableRow key={s.k} onClick={()=>setSel(s.k)} className="cursor-pointer hover:bg-accent/60">
       <TableCell className="px-3 py-2 font-medium whitespace-nowrap max-w-[200px] truncate">{s.t}{s.blocker&&<Badge variant="destructive" className="ml-2">Blocked</Badge>}{s.risk&&<Badge variant="warn" className="ml-2">At risk</Badge>}</TableCell>
       <TableCell className="px-3 py-2 text-muted-foreground max-w-[190px] truncate">{m(s)[0]}</TableCell>
       <TableCell className="px-3 py-2"><AvStack names={[s.who,...(s.st==='Approval pending'?['Ravi']:[])]}/></TableCell>
       <TableCell className="px-3 py-2 whitespace-nowrap text-muted-foreground">{m(s)[1]}</TableCell>
       <TableCell className="px-3 py-2 whitespace-nowrap">{s.due}{s.overdue&&<span className="text-destructive text-xs ml-1">overdue</span>}</TableCell>
       <TableCell className="px-3 py-2"><Pri p={m(s)[2]}/></TableCell>
       <TableCell className="px-3 py-2"><Chip icon="check" n={`${s.chk.filter(c=>c[1]).length}/${s.chk.length}`}/></TableCell>
       <TableCell className="px-3 py-2">{s.proto?<a href={s.proto} target="_blank" onClick={e=>e.stopPropagation()} className="inline-flex items-center gap-1 rounded-full bg-accent text-primary px-2.5 py-0.5 text-xs"><Icon n="link" c="h-3 w-3"/>Prototype</a>:<span className="text-xs text-muted-foreground">{s.st==='Done'?'Missing':'—'}</span>}</TableCell><TableCell className="px-3 py-2"><Chip icon="msg" n={(s.reviews||[]).length}/></TableCell>
       <TableCell className="px-3 text-center text-muted-foreground">···</TableCell></TableRow>)}
      {!rows.length&&<TableRow><TableCell colSpan={10} className="px-3 py-4 text-center text-xs text-muted-foreground">No stories</TableCell></TableRow>}</TableBody></Table></div>}</div>)})}
   {view==='kanban'&&<div className="grid gap-4 md:grid-cols-4">{GROUPS.map(([st,label,bgc,tc,pill])=><div key={st} className="space-y-2"><div className={cn('flex items-center gap-2 rounded-lg px-3 py-2',bgc)}><span className="text-sm font-semibold">{label}</span><span className={cn('rounded px-1.5 text-xs',pill,tc)}>{list.filter(s=>s.st===st).length}</span></div>
     {list.filter(s=>s.st===st).map(s=><button key={s.k} onClick={()=>setSel(s.k)} className="w-full text-left rounded-xl border border-border bg-card p-3 space-y-2 hover:shadow-sm"><div className="text-sm font-medium">{s.t}</div><div className="text-xs text-muted-foreground line-clamp-2">{m(s)[0]}</div><div className="flex items-center gap-2"><Pri p={m(s)[2]}/><span className="flex-1"/><AvStack names={[s.who]}/></div><div className="text-xs text-muted-foreground">Due {s.due}</div></button>)}</div>)}</div>}
   {view==='calendar'&&(()=>{const bucket=s=>{const [mo,n]=s.due.split(' ');const i=DAYS.findIndex((d,j)=>d.endsWith(' '+n)&&((j<2)===(mo==='Sep')));return i};const heads=['Earlier',...DAYS];return <div className="overflow-x-auto rounded-xl border border-border bg-card"><div className="grid min-w-[1100px]">{heads.map((h,i)=><div key={h} className="border-b border-r border-border bg-muted/40 px-2 py-2 text-xs font-medium text-muted-foreground">{h}</div>)}{heads.map((h,i)=><div key={h+'b'} className="border-r border-border p-1.5 space-y-1.5 min-h-[260px]">{list.filter(s=>bucket(s)+1===i).map(s=><button key={s.k} onClick={()=>setSel(s.k)} className="w-full text-left rounded-md border-l-2 border-primary bg-accent px-2 py-1.5 text-xs"><div className="font-medium truncate">{s.t}</div><div className="text-muted-foreground">{s.who}</div></button>)}</div>)}</div></div>})()}
   </div></div>)};
 const vStory=()=>{const s=stories.find(x=>x.k===sel);const d=s.chk.filter(c=>c[1]).length;
  const own=s.who==='Subash',ro=!lead&&(!own||onLeave),revs=s.reviews||[];
  const active=['To do','In progress'].includes(s.st);
  return(
  <div className="space-y-6"><Button variant="ghost" size="sm" onClick={()=>setSel(null)}><Icon n="back"/>Back</Button>
  <div className="flex flex-wrap items-start gap-3"><div className="flex-1 min-w-[240px]"><div className="text-xs font-mono text-muted-foreground">{s.k}</div><h1 className="text-2xl font-bold">{s.t}</h1><div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground"><Avatar name={s.who} c="h-6 w-6"/>{s.who}{s.iter>0&&<Badge variant="outline">Iteration {s.iter+1}</Badge>}</div></div>
   {lead?<div className="w-44"><Select value={s.st} onChange={e=>{upd(s.k,{st:e.target.value});ev(s.k,'Status → '+e.target.value);say(s.k+' → '+e.target.value)}}>{['To do','In progress','Approval pending','Done','On hold'].map(x=><option key={x}>{x}</option>)}</Select></div>:<StatusBadge s={s} className="text-sm px-3 py-1"/>}</div>
  {ro&&<Alert icon={own?'cal':'eye'} title={own?'You’re on leave — this story is locked':`View only · ${s.who}’s story`}>{own?'Edits are disabled until you cancel today’s leave.':'You can follow progress, prototype links and review comments, but not change anything.'}</Alert>}
  {s.blocker&&<Alert variant="destructive" icon="ban" title={`Blocked · waiting on ${s.blocker.on}`}><div className="flex gap-2 mt-2">{lead&&!s.blocker.ack&&<Button size="sm" variant="outline" onClick={()=>{upd(s.k,{blocker:{...s.blocker,ack:true}});ev(s.k,'Blocker acknowledged');say('Blocker acknowledged')}}>Acknowledge</Button>}{s.blocker.ack&&<Badge variant="outline">Acknowledged</Badge>}{!ro&&<Button size="sm" onClick={()=>resolve(s.k)}>Mark resolved</Button>}</div></Alert>}
  {s.handoff&&<Alert icon="swap" title={`Handoff proposed to ${s.handoff}`}>Waiting for them to accept.{!ro&&<span className="inline-flex gap-2 ml-2"><Button size="sm" onClick={()=>{upd(s.k,{who:s.handoff,handoff:null});ev(s.k,`${s.handoff} accepted the handoff`);say(`${s.handoff} accepted ${s.k}`)}}>Accept as {s.handoff}</Button><Button size="sm" variant="ghost" onClick={()=>{upd(s.k,{handoff:null});say('Handoff cancelled')}}>Cancel</Button></span>}</Alert>}
  {s.risk&&<Alert variant="warn" title="Flagged at risk">{s.risk} {!ro&&<Button variant="link" size="sm" className="ml-2 h-auto p-0" onClick={()=>upd(s.k,{risk:null})}>Clear</Button>}</Alert>}
  {!ro&&!lead&&<Card className="border-primary/30"><CardContent className="p-4 flex flex-wrap items-center gap-3">
   {active&&<><div className="flex-1 min-w-[220px]"><div className="text-sm font-semibold">Done with your part?</div><div className="text-xs text-muted-foreground">Send it to the BA. You’ll mark the result once they respond.</div></div><Button onClick={()=>{upd(s.k,{st:'Approval pending'});ev(s.k,'Marked approval pending · sent to BA');say(s.k+' is now approval pending')}}><Icon n="eye"/>Mark approval pending</Button></>}
   {s.st==='Approval pending'&&<><div className="flex-1 min-w-[220px]"><div className="text-sm font-semibold">Waiting on the BA</div><div className="text-xs text-muted-foreground">What did the BA decide?</div></div><Button variant="outline" onClick={()=>{const n=(s.iter||0)+1;upd(s.k,{st:'In progress',iter:n});ev(s.k,`BA asked for changes · iteration ${n+1}`);say(`${s.k} back to In progress · iteration ${n+1}`)}}><Icon n="swap"/>BA wants changes → iterate</Button><Button onClick={()=>setDlg({type:'complete',k:s.k})}><Icon n="check"/>BA accepted → complete</Button></>}
   {s.st==='Done'&&<><Icon n="checkc" c="h-5 w-5 text-foreground"/><div className="flex-1 text-sm font-semibold">Completed · prototype link on record</div></>}
  </CardContent></Card>}
  {!ro&&<div className="flex flex-wrap gap-2">{!s.blocker&&s.st!=='Done'&&<Button variant="outline" size="sm" onClick={()=>setDlg({type:'blocker',k:s.k})}><Icon n="ban"/>Raise blocker</Button>}
   {s.st!=='Done'&&<><Button variant="outline" size="sm" onClick={()=>setDlg({type:'handoff',k:s.k})}><Icon n="swap"/>Hand off</Button>
   <Button variant="outline" size="sm" onClick={()=>{ev(s.k,'Asked the team for help');say('Help request posted on '+s.k)}}><Icon n="help"/>Ask for help</Button></>}
   {!s.risk&&s.st!=='Done'&&<Button variant="ghost" size="sm" onClick={()=>upd(s.k,{risk:'Needs attention'})}><Icon n="alert"/>Flag at risk</Button>}</div>}
  <div className="grid gap-4 md:grid-cols-2">
   <Card><CardHeader><CardTitle>Schedule &amp; delivery</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
    <Row k="Due" v={s.due}/><Row k="Estimate" v={s.est+' days'}/><Row k="Baseline" v={s.base}/>{s.moved&&<Row k="Revision" v={`${s.base} → ${s.due} · ${s.moved}`}/>}<Row k="Iterations" v={(s.iter||0)+1}/>
    <div className="flex justify-between"><span className="text-muted-foreground">Prototype</span>{s.proto?<a href={s.proto} target="_blank" className="font-medium text-primary underline truncate max-w-[200px]">{s.proto.replace(/^https?:\/\//,'')}</a>:<span className="text-xs text-muted-foreground">{s.st==='Done'?'Missing':'Required to complete'}</span>}</div>
    {!ro&&s.st!=='Done'&&<Button variant="outline" size="sm" onClick={()=>setDlg({type:'revise',k:s.k})}>Revise date…</Button>}</CardContent></Card>
   <Card><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>Checklist</CardTitle><span className="text-xs text-muted-foreground">{d} of {s.chk.length}</span></CardHeader><CardContent className="space-y-2">
    {s.chk.map((c,i)=><label key={i} className="flex items-center gap-2.5 text-sm"><Checkbox disabled={ro} checked={c[1]} onChange={v=>upd(s.k,x=>({chk:x.chk.map((y,j)=>j===i?[y[0],v?1:0]:y)}))}/><span className={c[1]?'line-through text-muted-foreground':''}>{c[0]}</span></label>)}{!s.chk.length&&<div className="text-xs text-muted-foreground">No items yet</div>}</CardContent></Card></div>
  <Card><CardHeader><CardTitle>Review &amp; comments</CardTitle><CardDesc>Only the Lead or Manager can review. {lead?'Designers can reply to each comment.':'You can reply to their comments.'}</CardDesc></CardHeader><CardContent className="space-y-4">
   {!revs.length&&<div className="text-sm text-muted-foreground">No review comments yet.</div>}
   {revs.map(r=><div key={r.id} className="space-y-2"><div className="flex gap-2.5"><Avatar name={r.by} c="h-7 w-7"/><div className="flex-1 rounded-lg border border-border p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><span className="font-medium text-foreground">{r.by}</span><Badge variant="secondary">{r.role}</Badge>{r.at}</div><div className="text-sm">{r.text}</div></div></div>
    {r.replies.map((p,i)=><div key={i} className="flex gap-2.5 ml-9"><Avatar name={p.by} c="h-6 w-6 text-[10px]"/><div className="flex-1 rounded-lg bg-muted/60 px-3 py-2 text-sm"><div className="text-xs text-muted-foreground">{p.by} · {p.at}</div>{p.text}</div></div>)}
    {!lead&&own&&!ro&&<div className="ml-9"><CommentBox placeholder="Reply…" label="Reply" onSend={t=>addReply(s.k,r.id,t)}/></div>}</div>)}
   {lead&&<div className="border-t border-border pt-3"><CommentBox placeholder={`Add a review comment for ${s.who}…`} label="Post" onSend={t=>addReview(s.k,t)}/></div>}</CardContent></Card>
  <Card><CardHeader><CardTitle>Activity</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
   {(s.events||[]).map((e,i)=><div key={i} className="flex gap-2.5 items-center text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary/60 ml-2"/><span>{e.t} <span className="text-xs">· {e.by} · {e.at}</span></span></div>)}
   {s.moved&&<div className="flex gap-2.5 items-center text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary/60 ml-2"/>Date revised · {s.moved}</div>}
   <div className="flex gap-2.5 items-center text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-border ml-2"/>Ravi created the story · Sep 24</div></CardContent></Card></div>)};

 const cellState=(n,i)=>n==='Chen'&&(i===0||(i>=5&&i<=7))?'away':n==='Ben'&&i===8?'req':n==='Ben'&&i===0?'half':(i===3?'hol':'');
 const vLeave=()=>(<div className="space-y-6"><Head title="Leave & Calendar" sub="Derived day status for the next two weeks" action={<Button onClick={()=>setDlg({type:'leave'})}><Icon n="plus"/>Request leave</Button>}/>
  <Card className="overflow-x-auto"><Table className="w-full text-xs"><TableHeader><TableRow><TableHead className="p-2 text-left font-medium text-muted-foreground w-24"></TableHead>{DAYS.map((d,i)=><TableHead key={d} className={cn('p-2 font-medium text-muted-foreground',i===0&&'text-foreground')}>{d}</TableHead>)}</TableRow></TableHeader><TableBody>
   {TEAM.map(p=><TableRow key={p.n} className="border-t border-border"><TableCell className="p-2 font-medium text-sm">{p.n}</TableCell>{DAYS.map((d,i)=>{const c=cellState(p.n,i);return <TableCell key={d} className="p-1"><div className={cn('h-8 rounded-md grid place-items-center text-[10px]',c===''&&'bg-secondary',c==='away'&&'bg-muted text-muted-foreground',c==='half'&&'bg-secondary text-foreground',c==='req'&&'border border-dashed border-border bg-secondary text-foreground',c==='hol'&&'bg-muted/60 text-muted-foreground')}>{c==='away'?'Away':c==='half'?'½':c==='req'?'Pending':c==='hol'?'Holiday':''}</div></TableCell>})}</TableRow>)}</TableBody></Table></Card>
  <div className="flex gap-4 text-xs text-muted-foreground"><span><i className="inline-block h-2.5 w-2.5 rounded bg-secondary mr-1.5"/>Available</span><span><i className="inline-block h-2.5 w-2.5 rounded bg-secondary mr-1.5"/>Partial</span><span><i className="inline-block h-2.5 w-2.5 rounded bg-muted border border-border mr-1.5"/>Away / holiday</span></div>
  <Sec title={lead?'Requests & approvals':'My requests'}>{leave.filter(l=>lead||l.who==='Chen').map(l=><Card key={l.id}><CardContent className="p-3 flex items-center gap-3"><Avatar name={l.who}/><div className="flex-1"><div className="text-sm font-medium">{l.who} · {l.dates}</div><div className="text-xs text-muted-foreground">{l.type}{l.state==='Pending'&&lead&&' · conflict with DES-139'}</div></div><Badge variant={l.state==='Approved'?'ok':l.state==='Pending'?'warn':'destructive'}>{l.state}</Badge>
   {lead&&l.state==='Pending'&&<><Button size="sm" variant="outline" onClick={()=>{setLeave(x=>x.map(y=>y.id===l.id?{...y,state:'Rejected'}:y));say('Rejected')}}>Reject</Button><Button size="sm" onClick={()=>{setLeave(x=>x.map(y=>y.id===l.id?{...y,state:'Approved'}:y));say('Approved')}}>Approve</Button></>}</CardContent></Card>)}</Sec></div>);

 const vInbox=()=>{const items=myInbox;const cur=items.find(i=>i.id===mailSel)||null;
  const open=i=>{setMailSel(i.id);setReadIds(r=>r.includes(i.id)?r:[...r,i.id])};
  const act=i=>i.to[0]==='story'?(setPage('stories'),setSel(i.to[1])):go(i.to[0],i.to[1]);
  return(<div className="space-y-4"><Head title="Inbox" sub="Info · Important · Critical (email for the last two)"/>
  <div className="grid overflow-hidden rounded-xl border bg-card md:grid-cols-[340px_1fr]">
   <div className="border-b md:border-b-0 md:border-r"><div className="flex items-center justify-between px-4 py-3"><h2 className="text-sm font-semibold">Notifications</h2><span className="text-xs text-muted-foreground">{items.filter(i=>!readIds.includes(i.id)).length} unread</span></div><div className="h-px bg-border"/>
    <div className="max-h-[520px] overflow-auto p-2 space-y-1">{items.map(i=><button key={i.id} onClick={()=>open(i)} className={cn('flex w-full flex-col gap-1 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent',cur?.id===i.id&&'bg-muted')}>
     <div className="flex items-center gap-2"><span className="font-semibold">{i.t}</span>{!readIds.includes(i.id)&&<span className="ml-auto size-2 rounded-full bg-primary"/>}</div>
     <div className="text-xs text-muted-foreground line-clamp-2">{i.d}</div><div><Badge variant={i.lvl==='Important'?'default':'secondary'}>{i.lvl}</Badge></div></button>)}
     {!items.length&&<Empty>Inbox zero</Empty>}</div></div>
   <div className="min-h-[260px] p-6">{cur?<div className="space-y-4"><div className="flex items-start gap-3"><div className="flex-1"><h2 className="text-lg font-bold">{cur.t}</h2><div className="text-sm text-muted-foreground">{cur.lvl} · just now</div></div><Button size="icon" variant="ghost" onClick={()=>{setInbox(x=>x.filter(y=>y.id!==cur.id));setMailSel(null)}}><Icon n="x"/></Button></div>
    <div className="h-px bg-border"/><p className="text-sm">{cur.d}</p>{cur.act&&<Button onClick={()=>act(cur)}>{cur.act}</Button>}</div>:<div className="grid h-full place-items-center text-sm text-muted-foreground">Select a notification to read it</div>}</div>
  </div></div>)};
 const vAdmin=()=>(<div className="space-y-6"><Head title="Admin" sub="Set up once, everything else is derived"/><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{['People & roles','Team & memberships','Holidays','Leave types','Work week','Digest time','Signal thresholds','Security audit log'].map(x=><button key={x} onClick={()=>say(x+' — not in prototype')} className="text-left"><Card className="hover:bg-accent transition-colors"><CardContent className="p-4"><div className="text-sm font-medium">{x}</div><div className="text-xs text-muted-foreground">Configure →</div></CardContent></Card></button>)}</div></div>);

 /* ---------- dialogs ---------- */
 const D=()=>{if(!dlg)return null;const close=()=>setDlg(null);const t=dlg.type;
  if(t==='checkin')return <CheckinDlg/>;
  if(t==='review')return <ReviewDlg/>;
  if(t==='complete')return <CompleteDlg/>;
  if(t==='conflict')return <ConflictDlg/>;
  if(t==='handoff')return <HandoffDlg/>;
  if(t==='revise')return <ReviseDlg/>;
  if(t==='leave')return <LeaveDlg/>;
  if(t==='blocker')return <BlockerDlg/>;
  if(t==='new')return <NewDlg/>;
 };
 const ReviewDlg=()=>{const st=stories.find(x=>x.k===dlg.k);const [v,setV]=useState('');return <Dialog open onClose={()=>setDlg(null)} title={`Review comment · ${dlg.k}`} desc={`Only you and the Manager can review. ${st.who} can reply, not edit.`} footer={<><Button variant="outline" onClick={()=>setDlg(null)}>Cancel</Button><Button disabled={!v.trim()} onClick={()=>{addReview(dlg.k,v.trim());setDlg(null)}}>Post comment</Button></>}><Field label="Comment"><Textarea rows={4} value={v} onChange={e=>setV(e.target.value)} placeholder="What should change?"/></Field></Dialog>};
 const CompleteDlg=()=>{const [u,setU]=useState('');const cancel=()=>{if(dlg.prev!=null)upd(dlg.k,{pct:dlg.prev});setDlg(null)};const ok=/^https?:\/\/\S+\.\S+/.test(u);return <Dialog open onClose={cancel} title={`Complete · ${dlg.k}`} desc="A prototype link is required so the finished work can always be found." footer={<><Button variant="outline" onClick={cancel}>Cancel</Button><Button disabled={!ok} onClick={()=>{upd(dlg.k,{st:'Done',proto:u,blocker:null,doneOn:'2026-09-29',pct:100});ev(dlg.k,'BA accepted · completed with prototype link');setDlg(null);say(dlg.k+' completed')}}>Mark completed</Button></>}><Field label="Prototype link *"><Input autoFocus value={u} onChange={e=>setU(e.target.value)} placeholder="https://figma.com/proto/…"/></Field>{u&&!ok&&<div className="text-xs text-destructive">Enter a full link starting with http(s)://</div>}<Field label="Note (optional)"><Input/></Field></Dialog>};
 const HandoffDlg=()=>{const st=stories.find(x=>x.k===dlg.k);const [to,setTo]=useState(TEAM.find(p=>p.n!==st.who).n);return <Dialog open onClose={()=>setDlg(null)} title={`Hand off · ${dlg.k}`} desc="They need to accept before it moves." footer={<><Button variant="outline" onClick={()=>setDlg(null)}>Cancel</Button><Button onClick={()=>{upd(dlg.k,{handoff:to});ev(dlg.k,`Proposed handoff to ${to}`);setDlg(null);say(`Handoff proposed to ${to}`)}}>Propose handoff</Button></>}>
  <Field label="Hand over to"><Select value={to} onChange={e=>setTo(e.target.value)}>{TEAM.filter(p=>p.n!==st.who).map(p=>{const pp=people.find(x=>x.n===p.n);return <option key={p.n} value={p.n}>{p.n} · {pp.av}, {pp.load[0]}d of {pp.load[1]}d</option>})}</Select></Field><Field label="Note for them"><Textarea rows={3} placeholder="Where you left off, links, gotchas…"/></Field></Dialog>};
 const ReviseDlg=()=>{const [d,setD]=useState(''),[r,setR]=useState('Scope grew'),[n,setN]=useState('');return <Dialog open onClose={()=>setDlg(null)} title={`Revise due date · ${dlg.k}`} desc="The original date is kept as the baseline." footer={<><Button variant="outline" onClick={()=>setDlg(null)}>Cancel</Button><Button disabled={!d} onClick={()=>{upd(dlg.k,{due:iso2(d),moved:r,overdue:0});ev(dlg.k,`Due date → ${iso2(d)} (${r})`);setDlg(null);say(`${dlg.k} due date revised`)}}>Save revision</Button></>}>
  <Field label="New date"><DatePicker value={d} onChange={setD}/></Field><Field label="Reason (required)"><Select value={r} onChange={e=>setR(e.target.value)}><option>Scope grew</option><option>Waiting on input</option><option>Re-prioritised</option><option>Estimate was off</option></Select></Field><Field label="Note"><Input value={n} onChange={e=>setN(e.target.value)}/></Field></Dialog>};
 const LeaveDlg=()=>{const [f,setF]=useState(''),[t,setT]=useState(''),[ty,setTy]=useState('Annual');const hit=f&&t&&f<='2026-10-06'&&t>='2026-10-06';return <Dialog open onClose={()=>setDlg(null)} title="Request leave" desc="Conflicts are checked as you pick dates." footer={<><Button variant="outline" onClick={()=>setDlg(null)}>Cancel</Button><Button disabled={!f} onClick={()=>{const to=t||f;setLeave(l=>[...l,{id:Date.now(),who:lead?'Ravi':'Subash',dates:f===to?iso2(f):iso2(f)+'–'+iso2(to).split(' ')[1],type:ty,state:'Pending'}]);setInbox(i=>[{id:Date.now()+1,lead:1,lvl:'Important',t:`Subash requested leave · ${iso2(f)}`,d:hit?'1 story due in range':'No conflicts',act:'Review',to:['leave']},...i]);setDlg(null);say('Leave request sent to Lead & Manager')}}>Submit</Button></>}>
  <Field label="Type"><Select value={ty} onChange={e=>setTy(e.target.value)}><option>Annual</option><option>Sick</option><option>Other</option></Select></Field>
  <div className="grid grid-cols-2 gap-3"><Field label="From"><DatePicker value={f} onChange={setF}/></Field><Field label="To"><DatePicker value={t} min={f} onChange={setT}/></Field></div>
  {hit?<Alert variant="warn" title="1 conflict found">DES-151 Icon set v2 is due Oct 6 while you’re away. Consider a handoff.</Alert>:f&&<Alert icon="check" title="No conflicts">Nothing of yours is due in that range.</Alert>}
  <Field label="Reason (only approvers see it)"><Input/></Field></Dialog>};
 const CheckinDlg=()=>{const [loc,setLoc]=useState(ci.loc),[note,setNote]=useState(ci.note),[plan,setPlan]=useState(ci.plan);return(
  <Dialog open onClose={()=>setDlg(null)} title="Check-in" desc="Most days this is just one click." footer={<><Button variant="outline" onClick={()=>setDlg(null)}>Cancel</Button><Button onClick={()=>{setCi({done:true,loc,note,plan});setDlg(null);say('Check-in saved')}}>Save</Button></>}>
   <Field label="Location"><div><Segmented opts={['Office','Remote','Other']} value={loc} onChange={setLoc}/></div></Field>
   <Field label="Availability note (optional)"><Input value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. workshop 2–5 pm → shows as Partial"/></Field>
   <Field label="Today’s plan"><div className="space-y-2 pt-1">{stories.filter(s=>s.who==='Subash').map(s=><label key={s.k} className="flex items-center gap-2.5 text-sm"><Checkbox checked={plan.includes(s.t)} onChange={v=>setPlan(p=>v?[...p,s.t]:p.filter(x=>x!==s.t))}/>{s.t}</label>)}</div></Field></Dialog>)};
 const ConflictDlg=()=>{const [c,setC]=useState('a');return <Dialog open onClose={()=>setDlg(null)} title="Leave conflict · Chen, Oct 5–7" desc="DES-153 Empty states (3d) is due Oct 8. Chen has 1 working day before then." footer={<><Button variant="outline" onClick={()=>setDlg(null)}>Cancel</Button><Button onClick={()=>{if(c==='a')upd('DES-153',{due:'Oct 12',moved:'Leave conflict'});if(c==='b')upd('DES-153',{who:'Subash'});setConflictDone(true);setDlg(null);say(c==='a'?'DES-153 moved to Oct 12':c==='b'?'DES-153 reassigned to Subash':'Risk accepted on DES-153')}}>Apply</Button></>}>
  <RadioGroup value={c} onValueChange={setC} className="gap-3">{[['a','Move the due date','Reason is logged'],['b','Reassign to Subash','She has 3 days free'],['c','Accept the risk','Stays on the attention list']].map(([k,t,d])=><label key={k} htmlFor={'cf-'+k} className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-4 shadow-xs"><RadioGroupItem id={'cf-'+k} value={k} className="mt-0.5"/><div className="space-y-1"><div className="text-sm font-medium leading-none">{t}</div><div className="text-sm text-muted-foreground">{d}</div></div></label>)}</RadioGroup></Dialog>};
 const BlockerDlg=()=>{const [type,setType]=useState('Person'),[on,setOn]=useState('');return <Dialog open onClose={()=>setDlg(null)} title={`Raise blocker · ${dlg.k}`} desc="Three fields at most. Lead and Manager are notified." footer={<><Button variant="outline" onClick={()=>setDlg(null)}>Cancel</Button><Button variant="destructive" onClick={()=>{upd(dlg.k,{blocker:{on:on||'someone',ack:false}});setInbox(i=>[{id:Date.now(),lead:1,lvl:'Important',t:`${dlg.k} is blocked`,d:`Waiting on ${on||'someone'}`,act:'Acknowledge',to:['team','attn']},...i]);setDlg(null);say('Lead & Manager notified')}}>Raise blocker</Button></>}>
  <Field label="Waiting on"><div><Segmented opts={['Story','Person','Outside party']} value={type} onChange={setType}/></div></Field><Field label="Who or what"><Input value={on} onChange={e=>setOn(e.target.value)} placeholder="e.g. PM · copy approval"/></Field><Field label="What do you need?"><Input/></Field></Dialog>};
 const NewDlg=()=>{const [t,setT]=useState(''),[a,setA]=useState('Subash');return <Dialog open onClose={()=>setDlg(null)} title="New story" footer={<><Button variant="outline" onClick={()=>setDlg(null)}>Cancel</Button><Button disabled={!t} onClick={()=>{setStories(s=>[{k:'DES-'+(160+s.length),t,who:a,st:'To do',due:'Oct 9',base:'Oct 9',est:1,chk:[]},...s]);setDlg(null);say('Story created')}}>Create</Button></>}>
  <Field label="Title *"><Input value={t} onChange={e=>setT(e.target.value)} autoFocus/></Field>
  <div className="grid grid-cols-2 gap-3"><Field label="Assignee"><Select value={a} onChange={e=>setA(e.target.value)}>{TEAM.map(p=><option key={p.n}>{p.n}</option>)}</Select></Field><Field label="Requested by"><Input placeholder="PM / client"/></Field><Field label="Estimate (days)"><Input type="number" step=".5" defaultValue={1}/></Field><Field label="Due"><DatePicker value="" onChange={()=>{}}/></Field></div></Dialog>};

 const view0=(!lead&&!ci.started)?<StartGate stories={stories} onStart={start}/>:sel?vStory():{day:vDay,team:vTeam,stories:vStories,leave:vLeave,inbox:vInbox,admin:vAdmin}[page]();


 const areas=[['Checkout','Checkout'],['Onboarding','Onboarding'],['Design tokens','tokens'],['Settings IA','Settings']];
 const crumbs2=[page==='stories'?'Projects':null,nav.find(n=>n[0]===page)?.[1]||(page==='admin'?'Admin':null),sel].filter(Boolean);
 const NI={day:IconHome,team:IconUsers,stories:IconListDetails,leave:IconCalendar,inbox:IconInbox};
 const dot={Available:'bg-primary',Partial:'bg-chart-1',Away:'bg-border'};
 const me={n:lead?'Ravi':'Subash',e:lead?'ravi@team.com':'subash@team.com'};
 return(<SidebarProvider style={{'--sidebar-width':'calc(var(--spacing) * 72)','--header-height':'calc(var(--spacing) * 12)'}}>
  <Sidebar variant="inset" collapsible="icon">
   <SidebarHeader><SidebarMenu><SidebarMenuItem>
    <SidebarBrand onLogo={()=>say('Switch workspace')}/>
   </SidebarMenuItem></SidebarMenu></SidebarHeader>
   <SidebarContent>
    <SidebarGroup><SidebarGroupContent className="flex flex-col gap-2">
     
     <SidebarMenu>{nav.map(([k,l])=>{const I=NI[k];return <SidebarMenuItem key={k}><SidebarMenuButton className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary/90 data-[active=true]:hover:text-primary-foreground" tooltip={l} isActive={page===k&&!(k==='stories'&&q)} onClick={()=>{go(k);if(k==='stories')setQ('')}}><I/><span>{l}</span></SidebarMenuButton>{k==='inbox'&&myInbox.length>0&&<SidebarMenuBadge className="peer-data-[active=true]/menu-button:text-primary-foreground">{myInbox.length}</SidebarMenuBadge>}</SidebarMenuItem>})}</SidebarMenu>
    </SidebarGroupContent></SidebarGroup>
   </SidebarContent>
   <SidebarFooter><SidebarMenu><SidebarMenuItem><DropdownMenu>
    <DropdownMenuTrigger asChild><SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
     <Avatar name={me.n} c="size-8"/><div className="grid flex-1 text-left text-sm leading-tight"><span className="truncate font-medium">{me.n}</span><span className="truncate text-xs text-muted-foreground">{me.e}</span></div><IconDotsVertical className="ml-auto size-4"/></SidebarMenuButton></DropdownMenuTrigger>
    <DropdownMenuContent className="w-56" side="top" align="end"><DropdownMenuLabel>Viewing as</DropdownMenuLabel>
     <DropdownMenuItem onClick={()=>switchRole('member')}>Subash · Designer</DropdownMenuItem><DropdownMenuItem onClick={()=>switchRole('lead')}>Ravi · Lead</DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem onClick={()=>say('Logged out — not in prototype')}>Log out</DropdownMenuItem></DropdownMenuContent>
   </DropdownMenu></SidebarMenuItem></SidebarMenu></SidebarFooter>
  </Sidebar>
  <SidebarInset>
   <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b px-4 lg:px-6">
    
    <div className="flex items-center gap-2 text-base font-medium">{crumbs2.map((c,i)=><React.Fragment key={i}>{i>0&&<span className="text-muted-foreground">/</span>}<span className={i===crumbs2.length-1?'':'text-muted-foreground'}>{c}</span></React.Fragment>)}</div><span className="flex-1"/>
    <div className="w-40"><Select size="sm" value={role} onChange={e=>switchRole(e.target.value)}><option value="member">Subash · Designer</option><option value="lead">Ravi · Lead</option></Select></div>
    <Button variant="outline" size="icon" onClick={()=>say('Starred')}><Icon n="star"/></Button>
    <Button variant="outline" size="icon" onClick={()=>go('inbox')} className="relative"><Icon n="bell"/>{myInbox.length>0&&<span className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-md bg-destructive px-1 text-[10px] text-white">{myInbox.length}</span>}</Button></header>
   <main className="flex flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6" key={page+sel+view}>{view0}</main>
  </SidebarInset>
  <D/>
  {toast&&<div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg">{toast}</div>}
 </SidebarProvider>);
}
const Head=({title,sub,action})=><div className="flex items-start gap-4"><div className="flex-1"><h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-muted-foreground">{sub}</p></div>{action}</div>;
const Sec=({title,count,children})=><section className="space-y-2"><h2 className="text-sm font-semibold flex items-center gap-2">{title}{count!=null&&<Badge variant="secondary">{count}</Badge>}</h2>{children}</section>;
const SidebarBrand=({onLogo})=>{const {state,toggleSidebar}=useSidebar();return <div className="flex items-center gap-1"><SidebarMenuButton className="data-[slot=sidebar-menu-button]:p-1.5! flex-1" tooltip="Expand sidebar" onClick={()=>state==='collapsed'?toggleSidebar():onLogo()}><IconInnerShadowTop className="size-5!"/><span className="text-base font-semibold">Daybook Design</span></SidebarMenuButton><SidebarTrigger className="shrink-0 group-data-[collapsible=icon]:hidden"/></div>};
const Stat=({title,n,d,green})=><Card className={cn("@container/card bg-linear-to-t shadow-xs","from-primary/5 to-card")}><CardHeader className="pb-0"><div className="flex h-7 items-center"><CardDesc className={cn("text-sm","")}>{title}</CardDesc></div><CardTitle className={cn("text-2xl font-bold tabular-nums @[250px]/card:text-3xl",green&&"text-green-600")}>{n}</CardTitle></CardHeader><CardContent className={cn("pt-1 text-sm text-muted-foreground","")}>{d}</CardContent></Card>;
const Row=({k,v})=><div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
const Empty=({children})=><div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{children}</div>;
export default App
