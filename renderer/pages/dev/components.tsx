import { useState } from 'react'
import Head from 'next/head'
import Icon, { ALL_ICON_NAMES } from '../../components/ui/Icon'
import Logo from '../../components/ui/Logo'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Tag, { type TagColor } from '../../components/ui/Tag'
import Checkbox from '../../components/ui/Checkbox'
import UserGroup, { type Member } from '../../components/ui/UserGroup'
import PriorityTag, { type Priority } from '../../components/ui/PriorityTag'
import ActionItem from '../../components/ui/ActionItem'
import Schedule from '../../components/ui/Schedule'
import Task, { type TaskStatus } from '../../components/ui/Task'
import ProjectCard from '../../components/ui/ProjectCard'
import ProjectListCard from '../../components/ui/ProjectListCard'
import MenuItem from '../../components/ui/MenuItem'
import SideMenu, { type NavItem } from '../../components/ui/SideMenu'
import StackedSideMenu, { type StackedNavItem } from '../../components/ui/StackedSideMenu'
import ProjectLabel from '../../components/ui/ProjectLabel'
import MeetingTypeLabel from '../../components/ui/MeetingTypeLabel'
import MemberStatus from '../../components/ui/MemberStatus'
import Header from '../../components/ui/Header'
import AppLayout from '../../components/ui/AppLayout'
import Filter from '../../components/ui/Filter'
import FilterChecklist from '../../components/ui/FilterChecklist'
import Event from '../../components/ui/Event'
import Day from '../../components/ui/Day'
import Calendar, { type CalendarEvent } from '../../components/ui/Calendar'
import StatusLabelBig, { type Status } from '../../components/ui/StatusLabelBig'
import FileLabel from '../../components/ui/FileLabel'
import Table, { TableHeader, TableRow, TableCell, type Column } from '../../components/ui/Table'
import Radio from '../../components/ui/Radio'
import Option from '../../components/ui/Option'
import ReactionButton from '../../components/ui/ReactionButton'
import ChatHeader from '../../components/ui/ChatHeader'
import ChatMessage from '../../components/ui/ChatMessage'
import ChatDetails from '../../components/ui/ChatDetails'
import ChatSidebar, {
  type ChatSessionGroup,
  type ChatDmItem,
} from '../../components/ui/ChatSidebar'
import ChatComposer, {
  ChatComposerChip,
  ComposerIcons,
} from '../../components/ui/ChatComposer'

const TAG_COLORS: TagColor[] = ['blue', 'amber', 'green', 'red', 'gray', 'purple', 'dark']

const SAMPLE_MEMBERS: Member[] = [
  { name: 'Alice Park' },
  { name: 'Brian Lee' },
  { name: 'Cara Kim' },
  { name: 'Daniel Park' },
  { name: 'Eve Chen' },
  { name: 'Frank Yoo' },
]

const PRIORITIES: Priority[] = ['highest', 'high', 'medium', 'low', 'lowest']
const STATUSES: TaskStatus[] = ['planned', 'in-progress', 'review', 'done']

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', icon: 'Dashboard', label: 'Dashboard' },
  { key: 'projects', icon: 'Folder', label: 'Projects', count: 12 },
  { key: 'messages', icon: 'Chat', label: 'Messages', count: 5 },
  { key: 'calendar', icon: 'Calendar', label: 'Calendar' },
  { key: 'tasks', icon: 'Task', label: 'Action Items', count: 7 },
  { key: 'organization', icon: 'Organization', label: 'Organization' },
]
const FOOTER_ITEMS: NavItem[] = [{ key: 'settings', icon: 'Settings', label: 'Settings' }]

const PROJECT_NAV_ITEMS: StackedNavItem[] = [
  { key: 'dashboard', icon: 'Dashboard', label: 'Project Dashboard' },
  { key: 'kanban', icon: 'Kanban', label: 'Kanban Board' },
  { key: 'backlog', icon: 'Task', label: 'Backlog', count: 12 },
  { key: 'timeline', icon: 'Calendar', label: 'Timeline' },
  { key: 'meetings', icon: 'Meeting', label: 'Meetings' },
  { key: 'members', icon: 'People', label: 'Members', count: 12 },
  { key: 'knowledge', icon: 'File', label: 'Knowledge Base', count: 12 },
]

const ORG_NAV_ITEMS: StackedNavItem[] = [
  { key: 'dashboard', icon: 'Dashboard', label: 'Dashboard' },
  { key: 'projects', icon: 'Folder', label: 'Projects', count: 12 },
  { key: 'members', icon: 'People', label: 'Members', count: 108 },
  { key: 'knowledge', icon: 'File', label: 'Knowledge/ Governance' },
  { key: 'orgchart', icon: 'Organization', label: 'Org Chart' },
]

const STATUSES_BIG: Status[] = ['planned', 'in-progress', 'review', 'blocked', 'done', 'all']

const CALENDAR_MONTH = new Date(2026, 4, 1) // May 2026
const CALENDAR_TODAY = new Date(2026, 4, 10)

const SAMPLE_MESSAGE_BODY =
  'Q2 OKRs are locked — see the pinned doc. Three highlights: (1) Apollo cutover by May 11, (2) Aurora pilot expands to 6 customers, (3) hiring freeze lifts on the design team.'

const SAMPLE_CHAT_SESSIONS: ChatSessionGroup[] = [
  {
    label: 'Org-wide · Stratos Labs',
    items: [
      { id: 'general', name: 'general' },
      { id: 'random', name: 'random' },
    ],
  },
  {
    label: 'Assigned to projects',
    items: [
      { id: 'design-crit', name: 'design-crit', unreadCount: 2 },
      { id: 'leads', name: 'leads' },
    ],
  },
  {
    label: 'Member groups',
    items: [
      { id: 'apollo-end', name: 'apollo-end', projectTag: 'Apollo', unreadCount: 2, hasMention: true },
      { id: 'launch-may11', name: 'launch-may11', projectTag: 'Apollo' },
    ],
  },
]

const SAMPLE_CHAT_DMS: ChatDmItem[] = [
  { id: 'mira-1', name: 'Mira Chen', presence: 'available', preview: 'Yes — staging flake reproduced.', timeLabel: '2m', unreadCount: 2 },
  { id: 'mira-2', name: 'Mira Chen', presence: 'available', preview: 'You: Sounds good!', timeLabel: '2m' },
  { id: 'mira-3', name: 'Mira Chen', presence: 'in_meeting', preview: 'Yes — staging flake reproduced.', timeLabel: '2m' },
  { id: 'mira-4', name: 'Mira Chen', presence: 'in_meeting', preview: 'Yes — staging flake reproduced.', timeLabel: '2m' },
  { id: 'mira-5', name: 'Mira Chen', presence: 'unavailable', preview: 'Yes — staging flake reproduced.', timeLabel: '2m', unreadCount: 2 },
]

const SAMPLE_CAL_EVENTS: CalendarEvent[] = [
  { id: '1', date: '2026-05-04', title: 'Apollo standup', type: 'meeting' },
  { id: '2', date: '2026-05-05', title: 'Design crit', type: 'meeting' },
  { id: '3', date: '2026-05-05', title: 'Push v1.2', type: 'task' },
  { id: '4', date: '2026-05-10', title: 'Standup', type: 'meeting' },
  { id: '5', date: '2026-05-10', title: 'Auth deadline', type: 'deadline' },
  { id: '6', date: '2026-05-10', title: 'Code review', type: 'task' },
  { id: '7', date: '2026-05-10', title: 'Pricing review', type: 'project' },
  { id: '8', date: '2026-05-12', title: '1:1 with Daniel', type: 'meeting' },
  { id: '9', date: '2026-05-15', title: 'Sprint demo', type: 'meeting' },
  { id: '10', date: '2026-05-15', title: 'QA pass', type: 'task' },
  { id: '11', date: '2026-05-22', title: 'Q2 retro', type: 'meeting' },
]

function Section({
  title,
  background = 'light',
  children,
}: {
  title: string
  background?: 'light' | 'dark'
  children: React.ReactNode
}) {
  const isDark = background === 'dark'
  return (
    <section
      className="border border-gray-border-light rounded-lg overflow-hidden"
      style={{ backgroundColor: isDark ? '#2E434E' : '#FFFFFF' }}
    >
      <header
        className="px-6 py-3 border-b border-gray-border-light"
        style={{
          backgroundColor: isDark ? '#1F2F38' : '#F8F9FA',
          color: isDark ? '#F8F9FA' : '#16242E',
        }}
      >
        <h2 className="text-[14px] font-semibold tracking-[-0.2px]">{title}</h2>
      </header>
      <div className="p-6" style={{ color: isDark ? '#F8F9FA' : '#16242E' }}>
        {children}
      </div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 first:pt-0 last:pb-0 border-b last:border-b-0 border-gray-border-light/50">
      <div className="w-[140px] shrink-0 text-[11px] font-medium uppercase tracking-[1px] text-gray-secondary mt-1">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-3 flex-1">{children}</div>
    </div>
  )
}

export default function ComponentsPage() {
  const [actionChecked, setActionChecked] = useState(false)
  const [cb1, setCb1] = useState(false)
  const [cb2, setCb2] = useState(true)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [filterSel, setFilterSel] = useState('all')
  const [calChecks, setCalChecks] = useState<Record<string, boolean>>({
    meetings: true,
    tasks: true,
    deadlines: false,
  })
  const [calMonth, setCalMonth] = useState(CALENDAR_MONTH)
  return (
    <>
      <Head>
        <title>plinq · components</title>
      </Head>
      <main className="min-h-screen bg-gray-extra-light p-8">
        <div className="max-w-[1100px] mx-auto flex flex-col gap-6">
          <header className="flex items-center justify-between">
            <h1 className="text-[24px] font-semibold text-black">Component Showcase</h1>
            <span className="text-[11px] font-medium uppercase tracking-[1.5px] text-gray-secondary">
              Phase 1 · atomic + Phase 2 · domain + Phase 3 · layout + Phase 4 · calendar/table
            </span>
          </header>

          {/* LOGO */}
          <Section title="Logo">
            <div className="flex flex-col gap-0">
              <Row label="On light · 28">
                <Logo variant="on-light" size={28} />
              </Row>
              <Row label="On light · 40">
                <Logo variant="on-light" size={40} />
              </Row>
              <Row label="Icon only · 32">
                <Logo variant="icon-only" size={32} />
              </Row>
            </div>
          </Section>

          <Section title="Logo · on dark" background="dark">
            <div className="flex flex-col gap-0">
              <Row label="On dark · 28">
                <Logo variant="on-dark" size={28} />
              </Row>
              <Row label="On dark · 40">
                <Logo variant="on-dark" size={40} />
              </Row>
            </div>
          </Section>

          {/* ICONS */}
          <Section title={`Icons (${ALL_ICON_NAMES.length})`}>
            <div className="grid grid-cols-6 gap-4">
              {ALL_ICON_NAMES.map((name) => (
                <div
                  key={name}
                  className="flex flex-col items-center gap-2 p-3 border border-gray-border-light rounded-md"
                >
                  <span className="text-black">
                    <Icon name={name} size={20} />
                  </span>
                  <span className="text-[10px] text-gray-main font-mono truncate w-full text-center">
                    {name}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <p className="text-[11px] uppercase tracking-[1px] text-gray-secondary mb-2">
                Color follows currentColor
              </p>
              <div className="flex items-center gap-4 text-[24px]">
                <span className="text-black">
                  <Icon name="Calendar" size={24} />
                </span>
                <span className="text-blue-main">
                  <Icon name="Calendar" size={24} />
                </span>
                <span className="text-red-main">
                  <Icon name="Calendar" size={24} />
                </span>
                <span className="text-green-main">
                  <Icon name="Calendar" size={24} />
                </span>
                <span className="text-gray-secondary">
                  <Icon name="Calendar" size={24} />
                </span>
              </div>
            </div>
          </Section>

          {/* BUTTONS */}
          <Section title="Button">
            <div className="flex flex-col gap-0">
              <Row label="Primary">
                <Button>Button</Button>
                <Button iconLeft="Add">Button</Button>
                <Button iconRight="ArrowRight">Button</Button>
                <Button iconOnly="Add" />
                <Button disabled>Disabled</Button>
              </Row>
              <Row label="Secondary">
                <Button variant="secondary">Button</Button>
                <Button variant="secondary" iconLeft="Add">
                  Button
                </Button>
                <Button variant="secondary" iconRight="ArrowRight">
                  Button
                </Button>
                <Button variant="secondary" iconOnly="Dot-Menu" />
                <Button variant="secondary" disabled>
                  Disabled
                </Button>
              </Row>
              <Row label="Subtle">
                <Button variant="subtle">Button</Button>
                <Button variant="subtle" iconLeft="Filter">
                  Filter
                </Button>
              </Row>
              <Row label="Tertiary">
                <Button variant="tertiary">Button</Button>
                <Button variant="tertiary" iconLeft="Add">
                  Button
                </Button>
              </Row>
              <Row label="Compact">
                <Button size="compact">Button</Button>
                <Button size="compact" variant="secondary">
                  Button
                </Button>
                <Button size="compact" iconOnly="Search" />
              </Row>
              <Row label="Mini">
                <Button size="mini" variant="secondary">
                  Button
                </Button>
                <Button size="mini" variant="secondary" iconLeft="Add">
                  Button
                </Button>
                <Button size="mini" variant="subtle" iconRight="ArrowRight">
                  View all
                </Button>
              </Row>
            </div>
          </Section>

          {/* INPUTS */}
          <Section title="Input">
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap gap-6">
                <Input label="Default" placeholder="Enter value" />
                <Input label="Disabled" variant="disabled" defaultValue="Locked value" />
              </div>
              <div className="flex flex-wrap gap-6">
                <Input label="Error" variant="error" defaultValue="bad@" errorMessage="Invalid email" />
                <Input variant="search" placeholder="Search…" />
              </div>
            </div>
          </Section>

          <Section title="Input · translucent" background="dark">
            <div className="flex flex-wrap gap-6">
              <Input label="Email" variant="translucent" defaultValue="yujin@company.co" />
              <Input label="Password" variant="translucent" type="password" placeholder="••••••" />
            </div>
          </Section>

          {/* TAG */}
          <Section title="Tag">
            <div className="flex flex-col gap-0">
              {(['sm', 'md', 'lg'] as const).map((s) => (
                <Row key={s} label={`Size · ${s}`}>
                  {TAG_COLORS.map((c) => (
                    <Tag key={c} color={c} size={s}>
                      {c}
                    </Tag>
                  ))}
                </Row>
              ))}
              <Row label="With icon">
                <Tag color="blue" icon="Sparkle">Now in beta</Tag>
                <Tag color="red" icon="Highest">Highest</Tag>
                <Tag color="amber" icon="High">High</Tag>
                <Tag color="green" icon="Low">Low</Tag>
                <Tag color="gray" icon="Lowest">Lowest</Tag>
              </Row>
              <Row label="No uppercase">
                <Tag color="blue" uppercase={false}>Apollo</Tag>
                <Tag color="purple" uppercase={false} size="lg">Project Theta</Tag>
              </Row>
            </div>
          </Section>

          {/* CHECKBOX */}
          <Section title="Checkbox">
            <Row label="States">
              <Checkbox checked={cb1} onChange={setCb1} />
              <Checkbox checked={cb2} onChange={setCb2} />
              <Checkbox checked={cb1} onChange={setCb1} label="Click me" />
              <Checkbox checked={cb2} onChange={setCb2} label="Send notifications" />
            </Row>
          </Section>

          {/* PRIORITY TAG */}
          <Section title="Priority Tag">
            <Row label="With text">
              {PRIORITIES.map((p) => (
                <PriorityTag key={p} priority={p} />
              ))}
            </Row>
            <Row label="Icon only">
              {PRIORITIES.map((p) => (
                <PriorityTag key={p} priority={p} isText={false} />
              ))}
            </Row>
          </Section>

          {/* USER GROUP */}
          <Section title="User Group">
            <Row label="1 — 5 members">
              {[1, 2, 3, 4, 5].map((n) => (
                <UserGroup key={n} members={SAMPLE_MEMBERS.slice(0, n)} />
              ))}
            </Row>
            <Row label="6 members (overflow)">
              <UserGroup members={SAMPLE_MEMBERS} max={5} />
            </Row>
            <Row label="Sizes (15, 20, 28)">
              <UserGroup members={SAMPLE_MEMBERS.slice(0, 4)} size={15} />
              <UserGroup members={SAMPLE_MEMBERS.slice(0, 4)} size={20} />
              <UserGroup members={SAMPLE_MEMBERS.slice(0, 4)} size={28} />
            </Row>
            <Row label="Blue overflow">
              <UserGroup members={SAMPLE_MEMBERS} max={3} overflowVariant="blue" borderColor="#FFFFFF" />
            </Row>
          </Section>

          {/* ACTION ITEM */}
          <Section title="Action Item">
            <div className="flex flex-col gap-[5px]">
              <ActionItem
                title="Vendor SOC2 questionnaire"
                date="Apr 16"
                priority="high"
                projectTag={{ label: 'Project name', color: 'purple' }}
                checked={actionChecked}
                onCheckedChange={setActionChecked}
              />
              <ActionItem
                title="Review Q4 roadmap"
                date="Apr 18"
                priority="medium"
                projectTag={{ label: 'Apollo', color: 'blue' }}
              />
              <ActionItem
                title="Done — submit timesheets"
                date="Apr 10"
                priority="lowest"
                projectTag={{ label: 'Internal', color: 'gray' }}
                checked
              />
            </div>
          </Section>

          {/* SCHEDULE */}
          <Section title="Schedule · full">
            <div className="flex flex-col gap-[10px]">
              <Schedule
                title="Apollo standup"
                time="9:00 — 9:30 AM"
                isCurrent
                location="Zoom"
                attendees={SAMPLE_MEMBERS}
                attendeesLabel="Jane Doe, Stuart Smith, …"
                onJoin={() => alert('Join clicked')}
              />
              <Schedule
                title="Design Critique"
                time="10:00 — 11:30 AM"
                location="Conference Room B"
                attendees={SAMPLE_MEMBERS.slice(0, 4)}
                attendeesLabel="Cara Kim, Daniel Park"
              />
            </div>
          </Section>
          <Section title="Schedule · mini">
            <Row label="Mini">
              <Schedule size="mini" title="Apollo standup" time="9:00 AM" initial="A" />
              <Schedule size="mini" title="Pricing review" time="2:00 PM" isCurrent initial="P" />
            </Row>
          </Section>

          {/* TASK */}
          <Section title="Task (Kanban card)">
            <div className="flex flex-wrap gap-3">
              {STATUSES.map((status, i) => (
                <Task
                  key={status}
                  id={`APO-${235 + i}`}
                  title="Email template: account migration notice"
                  status={status}
                  priority={(['highest', 'high', 'medium', 'low'] as Priority[])[i] ?? 'medium'}
                  dueDate="Apr 22"
                  assignees={SAMPLE_MEMBERS.slice(0, 3 + i)}
                />
              ))}
            </div>
          </Section>

          {/* MENU ITEM */}
          <Section title="Menu Item">
            <Row label="Default">
              <div className="bg-[#F4F6F8] p-3 rounded-md inline-flex flex-col gap-1">
                <MenuItem icon="Dashboard" label="Dashboard" />
                <MenuItem icon="Folder" label="Projects" count={12} />
                <MenuItem icon="Chat" label="Messages" count={5} />
              </div>
            </Row>
            <Row label="Selected">
              <div className="bg-[#F4F6F8] p-3 rounded-md inline-flex flex-col gap-1">
                <MenuItem icon="Dashboard" label="Dashboard" selected />
                <MenuItem icon="Folder" label="Projects" count={12} selected />
              </div>
            </Row>
            <Row label="Thin">
              <div className="bg-[#F4F6F8] p-3 rounded-md inline-flex flex-col gap-1">
                <MenuItem icon="Dashboard" label="Dashboard" thin />
                <MenuItem icon="Folder" label="Projects" count={12} thin selected />
              </div>
            </Row>
            <Row label="Stacked (icon-only rail)">
              <div className="bg-[#F4F6F8] p-3 rounded-md inline-flex flex-col gap-1 items-center">
                <MenuItem icon="Dashboard" label="Dashboard" stacked selected />
                <MenuItem icon="Folder" label="Projects" stacked />
                <MenuItem icon="Calendar" label="Calendar" stacked />
                <MenuItem icon="Settings" label="Settings" stacked />
              </div>
            </Row>
          </Section>

          {/* SIDE MENU */}
          <Section title="Side Menu (full + stacked)">
            <div className="flex gap-6 items-start">
              <div className="border border-gray-border-light rounded-md overflow-hidden h-[600px]">
                <SideMenu
                  sectionLabel="Personal Space"
                  items={NAV_ITEMS}
                  footerItems={FOOTER_ITEMS}
                  activeKey={activeNav}
                  onItemClick={setActiveNav}
                  onCreateNew={() => alert('Create new')}
                  userInitials="YP"
                  userName="Yujin Park"
                />
              </div>
              <div className="border border-gray-border-light rounded-md overflow-hidden h-[600px]">
                <SideMenu
                  items={NAV_ITEMS}
                  footerItems={FOOTER_ITEMS}
                  activeKey={activeNav}
                  onItemClick={setActiveNav}
                  onCreateNew={() => alert('Create new')}
                  userInitials="YP"
                  userName="Yujin Park"
                  stacked
                />
              </div>
            </div>
          </Section>

          {/* STACKED SIDE MENU */}
          <Section title="Stacked Side Menu (Project + Org)">
            <div className="flex gap-6 items-start">
              <div className="border border-gray-border-light rounded-md overflow-hidden h-[600px] bg-[#F4F6F8]">
                <StackedSideMenu
                  header={{
                    kind: 'project',
                    initial: 'A',
                    color: '#2D5A9E',
                    name: 'Apollo',
                    subtitle: 'Auth migration · Q2 2026',
                    status: 'in-progress',
                  }}
                  items={PROJECT_NAV_ITEMS}
                  activeKey="dashboard"
                  onItemClick={(k) => alert(k)}
                  onBack={() => alert('back')}
                />
              </div>
              <div className="border border-gray-border-light rounded-md overflow-hidden h-[600px] bg-[#F4F6F8]">
                <StackedSideMenu
                  header={{
                    kind: 'org',
                    initial: 'A',
                    color: '#9B3838',
                    name: 'Org Name',
                    subtitle: '108 members total',
                  }}
                  items={ORG_NAV_ITEMS}
                  activeKey="dashboard"
                  onItemClick={(k) => alert(k)}
                  onBack={() => alert('back')}
                />
              </div>
            </div>
          </Section>

          {/* PROJECT LABEL */}
          <Section title="Project Label">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-gray-secondary text-[10px] mb-2 uppercase tracking-[1.5px]">
                  Palette keys (small)
                </p>
                <div className="flex items-center gap-3">
                  {(['blue', 'green', 'amber', 'red', 'purple', 'turquoise'] as const).map(
                    (c) => (
                      <ProjectLabel key={c} name={c} color={c} size="sm" />
                    )
                  )}
                </div>
              </div>
              <div>
                <p className="text-gray-secondary text-[10px] mb-2 uppercase tracking-[1.5px]">
                  Custom hex (medium)
                </p>
                <div className="flex items-center gap-3">
                  <ProjectLabel name="A" color="#FF6B35" size="md" />
                  <ProjectLabel name="B" color="#16A085" size="md" />
                  <ProjectLabel name="C" color="#9B59B6" size="md" />
                </div>
              </div>
            </div>
          </Section>

          {/* MEETING TYPE LABEL */}
          <Section title="Meeting Type Label">
            <div className="flex items-center gap-3">
              <MeetingTypeLabel type="planning" />
              <MeetingTypeLabel type="check_in" />
              <MeetingTypeLabel type="review" />
              <MeetingTypeLabel type="retrospective" />
            </div>
          </Section>

          {/* MEMBER STATUS */}
          <Section title="Member Status">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-gray-secondary text-[10px] mb-2 uppercase tracking-[1.5px]">
                  Presence
                </p>
                <div className="flex items-center gap-4">
                  <MemberStatus variant="presence" status="available" />
                  <MemberStatus variant="presence" status="in_meeting" />
                  <MemberStatus variant="presence" status="unavailable" />
                </div>
              </div>
              <div>
                <p className="text-gray-secondary text-[10px] mb-2 uppercase tracking-[1.5px]">
                  Permission
                </p>
                <div className="flex items-center gap-2">
                  <MemberStatus variant="permission" status="readonly" />
                  <MemberStatus variant="permission" status="editor" />
                  <MemberStatus variant="permission" status="admin" />
                </div>
              </div>
            </div>
          </Section>

          {/* HEADER */}
          <Section title="Header">
            <div className="flex flex-col gap-4">
              <div className="border border-gray-border-light rounded-md bg-white">
                <Header
                  eyebrow="Workspace · Friday, April 10"
                  title="Good morning, Yujin"
                  hasNotifications
                  onAskAi={() => alert('AI')}
                  onCreateNew={() => alert('Create')}
                />
              </div>
              <div className="border border-gray-border-light rounded-md bg-white">
                <Header hasNotifications={false} />
              </div>
            </div>
          </Section>

          {/* APP LAYOUT */}
          <Section title="App Layout (composition demo)">
            <div className="border border-gray-border-light rounded-md overflow-hidden h-[600px]">
              <AppLayout
                sidebar={
                  <SideMenu
                    sectionLabel="Personal Space"
                    items={NAV_ITEMS}
                    footerItems={FOOTER_ITEMS}
                    activeKey={activeNav}
                    onItemClick={setActiveNav}
                    onCreateNew={() => undefined}
                    userInitials="YP"
                    userName="Yujin Park"
                  />
                }
                header={
                  <div className="bg-white border-b border-gray-border-light">
                    <Header
                      eyebrow="Workspace · Friday, April 10"
                      title="Good morning, Yujin"
                      hasNotifications
                    />
                  </div>
                }
              >
                <div className="p-8">
                  <p className="text-black text-[14px]">
                    Page content goes here. Active item: <b>{activeNav}</b>.
                  </p>
                </div>
              </AppLayout>
            </div>
          </Section>

          {/* FILTER */}
          <Section title="Filter chip">
            <Row label="Toolbar">
              <div className="bg-[#EFF1F4] p-2 rounded-md inline-flex gap-1">
                {[
                  { k: 'all', l: 'All', c: 12 },
                  { k: 'mine', l: 'Mine', c: 4 },
                  { k: 'overdue', l: 'Overdue', c: 2 },
                ].map((f) => (
                  <Filter
                    key={f.k}
                    label={f.l}
                    count={f.c}
                    selected={filterSel === f.k}
                    onClick={() => setFilterSel(f.k)}
                  />
                ))}
              </div>
            </Row>
          </Section>

          {/* FILTER CHECKLIST */}
          <Section title="Filter Checklist (calendar sidebar)">
            <div className="border border-gray-border-light rounded-md p-4 bg-white inline-block">
              <FilterChecklist
                label="Meetings"
                count={14}
                color="#5B7FB6"
                checked={calChecks.meetings}
                onChange={(v) => setCalChecks((s) => ({ ...s, meetings: v }))}
              />
              <FilterChecklist
                label="Tasks"
                count={28}
                color="#588F6E"
                checked={calChecks.tasks}
                onChange={(v) => setCalChecks((s) => ({ ...s, tasks: v }))}
              />
              <FilterChecklist
                label="Deadlines"
                count={6}
                color="#9B3838"
                checked={calChecks.deadlines}
                onChange={(v) => setCalChecks((s) => ({ ...s, deadlines: v }))}
              />
            </div>
          </Section>

          {/* PROJECT CARD */}
          <Section title="Project Card">
            <div className="flex flex-wrap gap-3">
              <ProjectCard
                name="Apollo"
                description="Auth migration · Identity SDK + cutover runbook for 1.2M accounts."
                status="in-progress"
                progress={73}
                members={SAMPLE_MEMBERS}
                onOpen={() => alert('Open')}
              />
              <ProjectCard
                name="Pricing V2"
                description="New tier matrix + billing flow updates."
                status="review"
                progress={48}
                members={SAMPLE_MEMBERS.slice(0, 3)}
              />
              <ProjectCard
                name="Design System"
                description="Token migration to v4 and component library cleanup."
                status="done"
                progress={91}
                members={SAMPLE_MEMBERS.slice(0, 4)}
              />
              <ProjectCard
                name="Theta"
                description="Internal research project."
                status="planned"
                progress={12}
                members={SAMPLE_MEMBERS.slice(0, 2)}
              />
            </div>
          </Section>

          {/* PROJECT LIST CARD */}
          <Section title="Project List Card (Projects 페이지용)">
            <div className="grid grid-cols-2 gap-[10px]">
              <ProjectListCard
                name="Apollo"
                description="Auth migration · Identity SDK + cutover runbook for 1.2M accounts."
                status="in-progress"
                progress={72}
                tasksDone={94}
                tasksTotal={130}
                due="May 11"
                lead={SAMPLE_MEMBERS[3]}
                members={SAMPLE_MEMBERS}
              />
              <ProjectListCard
                name="Pricing V2"
                description="New tier matrix + billing flow updates."
                status="review"
                progress={48}
                tasksDone={20}
                tasksTotal={42}
                due="May 30"
                lead={SAMPLE_MEMBERS[0]}
                members={SAMPLE_MEMBERS.slice(0, 4)}
              />
              <ProjectListCard
                name="Theta"
                status="planned"
                progress={0}
                tasksDone={0}
                tasksTotal={0}
                lead={SAMPLE_MEMBERS[1]}
                members={SAMPLE_MEMBERS.slice(0, 2)}
              />
              <ProjectListCard
                name="Design System"
                description="Token migration to v4 and component library cleanup."
                status="done"
                progress={100}
                tasksDone={56}
                tasksTotal={56}
                due="Apr 18"
                lead={SAMPLE_MEMBERS[2]}
                members={SAMPLE_MEMBERS.slice(0, 5)}
              />
            </div>
          </Section>

          {/* EVENT */}
          <Section title="Event chip">
            <Row label="Small (Day cell)">
              <div style={{ width: 70 }}>
                <Event size="small" type="meeting" title="Apollo standup" />
              </div>
              <div style={{ width: 70 }}>
                <Event size="small" type="task" title="Review PR" />
              </div>
              <div style={{ width: 70 }}>
                <Event size="small" type="deadline" title="Auth ship" />
              </div>
              <div style={{ width: 70 }}>
                <Event size="small" type="project" title="Apollo" />
              </div>
            </Row>
            <Row label="Big (Monthly view)">
              <Event size="big" type="meeting" title="Apollo standup" />
              <Event size="big" type="task" title="Push v1.2" />
              <Event size="big" type="deadline" title="Auth ship" />
              <Event size="big" type="project" title="Pricing review" />
            </Row>
          </Section>

          {/* DAY */}
          <Section title="Day cell · small (Dashboard)">
            <Row label="Default · 0/1/2/3+ events">
              <Day size="small" date={1} />
              <Day size="small" date={2} events={SAMPLE_CAL_EVENTS.slice(0, 1)} />
              <Day size="small" date={3} events={SAMPLE_CAL_EVENTS.slice(0, 2)} />
              <Day size="small" date={4} events={SAMPLE_CAL_EVENTS.slice(0, 4)} />
            </Row>
            <Row label="Today">
              <Day size="small" date={10} isToday />
              <Day size="small" date={10} isToday events={SAMPLE_CAL_EVENTS.slice(0, 1)} />
              <Day size="small" date={10} isToday events={SAMPLE_CAL_EVENTS.slice(0, 4)} />
            </Row>
            <Row label="Out of bound">
              <Day size="small" date={31} outOfBound />
            </Row>
          </Section>

          <Section title="Day cell · big (Monthly)">
            <Row label="Default · 0/1/3+ events">
              <Day size="big" date={1} />
              <Day size="big" date={2} events={SAMPLE_CAL_EVENTS.slice(0, 1)} />
              <Day size="big" date={3} events={SAMPLE_CAL_EVENTS.slice(0, 5)} />
            </Row>
            <Row label="Today / Out of bound">
              <Day size="big" date={10} isToday events={SAMPLE_CAL_EVENTS.slice(0, 1)} />
              <Day size="big" date={11} isToday events={SAMPLE_CAL_EVENTS.slice(0, 6)} />
              <Day size="big" date={31} outOfBound />
            </Row>
          </Section>

          {/* CALENDAR */}
          <Section title="Calendar · Dashboard view">
            <div className="bg-white-white p-4 rounded-md inline-block">
              <Calendar
                view="dashboard"
                month={calMonth}
                today={CALENDAR_TODAY}
                events={SAMPLE_CAL_EVENTS}
                onPrevMonth={() =>
                  setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))
                }
                onNextMonth={() =>
                  setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))
                }
              />
            </div>
          </Section>

          <Section title="Calendar · Monthly view">
            <div className="bg-white-white p-4 rounded-md h-[700px]">
              <Calendar
                view="monthly"
                month={calMonth}
                today={CALENDAR_TODAY}
                events={SAMPLE_CAL_EVENTS}
                onPrevMonth={() =>
                  setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))
                }
                onNextMonth={() =>
                  setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))
                }
              />
            </div>
          </Section>

          {/* STATUS LABEL BIG */}
          <Section title="Status Label (Kanban column header)">
            <Row label="All statuses">
              {STATUSES_BIG.map((s) => (
                <StatusLabelBig key={s} status={s} />
              ))}
            </Row>
            <Row label="Sizes">
              <StatusLabelBig status="in-progress" size="md" />
              <StatusLabelBig status="in-progress" size="lg" />
            </Row>
          </Section>

          {/* FILE LABEL */}
          <Section title="File Label (Knowledge Base)">
            <Row label="Icon · default">
              <FileLabel variant="icon" category="project-context" />
              <FileLabel variant="icon" category="decisions" />
              <FileLabel variant="icon" category="references" />
            </Row>
            <Row label="Icon · large">
              <FileLabel variant="icon" category="project-context" size="lg" />
              <FileLabel variant="icon" category="decisions" size="lg" />
              <FileLabel variant="icon" category="references" size="lg" />
            </Row>
            <Row label="Text">
              <FileLabel variant="text" category="project-context" />
              <FileLabel variant="text" category="decisions" />
              <FileLabel variant="text" category="references" />
            </Row>
          </Section>

          {/* TABLE */}
          <Section title="Table · Personal Tasks">
            {(() => {
              const cols: Column[] = [
                { key: 'task', label: 'Action', width: 'flex-[2]' },
                { key: 'source', label: 'Source', width: 'w-[150px]' },
                { key: 'status', label: 'Status', width: 'w-[120px]' },
                { key: 'priority', label: 'Priority', width: 'w-[90px]' },
                { key: 'due', label: 'Due', width: 'w-[80px]' },
              ]
              const rows = [
                { task: 'Review site safety protocols', source: 'Standup, Apr 10', status: 'in-progress' as Status, priority: 'highest' as Priority, due: 'Today' },
                { task: 'Approve Q4 resource allocation', source: 'Email, Apr 9', status: 'planned' as Status, priority: 'high' as Priority, due: 'Tomorrow' },
                { task: 'Draft client feedback response', source: 'Slack, Apr 8', status: 'review' as Status, priority: 'medium' as Priority, due: 'Apr 14' },
              ]
              return (
                <Table>
                  <TableHeader columns={cols} />
                  {rows.map((r, i) => (
                    <TableRow key={i} isLast={i === rows.length - 1}>
                      <TableCell width="flex-[2]">
                        <Checkbox />
                        <span className="text-black text-[14px]">{r.task}</span>
                      </TableCell>
                      <TableCell width="w-[150px]">
                        <span className="text-gray-main text-[14px]">{r.source}</span>
                      </TableCell>
                      <TableCell width="w-[120px]">
                        <StatusLabelBig status={r.status} size="md" />
                      </TableCell>
                      <TableCell width="w-[90px]">
                        <PriorityTag priority={r.priority} />
                      </TableCell>
                      <TableCell width="w-[80px]">
                        <span
                          className="text-red-main text-[14px] font-semibold tracking-[-0.2px]"
                          style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                        >
                          {r.due}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </Table>
              )
            })()}
          </Section>

          <Section title="Table · Project Knowledge">
            {(() => {
              const cols: Column[] = [
                { key: 'title', label: 'Title', width: 'flex-[2]' },
                { key: 'type', label: 'Type', width: 'w-[90px]' },
                { key: 'tag', label: 'Tag', width: 'w-[180px]' },
                { key: 'size', label: 'Size', width: 'w-[80px]' },
                { key: 'edited', label: 'Edited', width: 'w-[150px]' },
              ]
              const rows = [
                { title: 'Onboarding deck', cat: 'project-context' as const, type: 'Whiteboard', size: '6.7MB', edited: 'Yesterday' },
                { title: 'Q3 decisions log', cat: 'decisions' as const, type: 'Doc', size: '1.2MB', edited: '2d ago' },
                { title: 'Compliance refs', cat: 'references' as const, type: 'PDF', size: '4.1MB', edited: 'Last week' },
              ]
              return (
                <Table>
                  <TableHeader columns={cols} />
                  {rows.map((r, i) => (
                    <TableRow key={i} isLast={i === rows.length - 1}>
                      <TableCell width="flex-[2]">
                        <FileLabel variant="icon" category={r.cat} />
                        <span className="text-black text-[14px]">{r.title}</span>
                      </TableCell>
                      <TableCell width="w-[90px]">
                        <span className="text-gray-main text-[14px]">{r.type}</span>
                      </TableCell>
                      <TableCell width="w-[180px]">
                        <FileLabel variant="text" category={r.cat} />
                      </TableCell>
                      <TableCell width="w-[80px]">
                        <span className="text-gray-main text-[14px]">{r.size}</span>
                      </TableCell>
                      <TableCell width="w-[150px]">
                        <UserGroup members={SAMPLE_MEMBERS.slice(0, 2)} />
                        <span className="text-gray-main text-[14px]">{r.edited}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </Table>
              )
            })()}
          </Section>

          {/* CHAT — Radio */}
          <Section title="Radio">
            <Row label="Selected / Unselected">
              <Radio selected={false} />
              <Radio selected />
            </Row>
          </Section>

          {/* CHAT — Option */}
          <Section title="Option (single-select picker row)">
            <div className="bg-white-item rounded-[5px] w-[289px] flex flex-col">
              <Option
                icon="People"
                title="Pick members directly"
                subtitle="Invite individuals"
                selected={false}
              />
              <Option
                icon="Folder"
                title="Assign to a project"
                subtitle="Members sync from selected project below"
                selected
              />
            </div>
          </Section>

          {/* CHAT — Reaction Button */}
          <Section title="Reaction Button">
            <Row label="Reactions">
              <ReactionButton variant="reaction" emoji="🎯" count={4} />
              <ReactionButton variant="reaction" emoji="🎯" count={4} selected />
              <ReactionButton variant="add" />
            </Row>
          </Section>

          {/* CHAT — Header */}
          <Section title="Chat Header — Channel">
            <div className="bg-background border border-gray-border-light rounded-md p-[20px]">
              <ChatHeader
                variant="channel"
                orgName="Stratos Labs"
                name="general"
                description="Org-wide announcements"
                memberCount={108}
                pinnedCount={3}
                members={SAMPLE_MEMBERS.slice(0, 4)}
                tipNode={
                  <>
                    <strong className="text-black font-semibold">#general</strong>{' '}
                    is the org-wide default channel. Everyone at Stratos Labs is a
                    member.
                  </>
                }
              />
            </div>
          </Section>

          <Section title="Chat Header — DM">
            <div className="bg-background border border-gray-border-light rounded-md p-[20px]">
              <ChatHeader
                variant="dm"
                name="Mira Chen"
                member={{ name: 'Mira Chen' }}
                isActive
                jobTitle="Senior Engineer"
                project={{ name: 'Apollo', color: 'blue' }}
                tipNode={
                  <>
                    This is the beginning of your direct conversation with{' '}
                    <strong className="text-black font-semibold">Mira Chen</strong>.
                    You share <strong className="text-black font-semibold">3 sessions</strong>.
                    Messages here are private to the two of you.
                  </>
                }
              />
            </div>
          </Section>

          {/* CHAT — Message */}
          <Section title="Chat Message">
            <div className="bg-white-white border border-gray-border-light rounded-md w-[600px] flex flex-col gap-[2px] py-[10px]">
              <ChatMessage
                author={{ name: 'Seoyeon Park' }}
                authorTag="Lead"
                time="10:31AM"
                body={SAMPLE_MESSAGE_BODY}
              />
              <ChatMessage
                author={{ name: 'Seoyeon Park' }}
                authorTag="Lead"
                time="10:31AM"
                body={SAMPLE_MESSAGE_BODY}
                reactions={[
                  { emoji: '🎯', count: 4 },
                  { emoji: '🎯', count: 4, selectedByMe: true },
                ]}
              />
              <ChatMessage
                author={{ name: 'Seoyeon Park' }}
                authorTag="Lead"
                time="10:31AM"
                body={SAMPLE_MESSAGE_BODY}
                reactions={[
                  { emoji: '🎯', count: 4 },
                  { emoji: '🎯', count: 4 },
                ]}
                thread={{
                  count: 12,
                  avatars: SAMPLE_MEMBERS.slice(0, 3),
                  lastReplyLabel: 'Last today at 2:14PM',
                }}
              />
              <ChatMessage
                author={{ name: 'Seoyeon Park' }}
                authorTag="Lead"
                time="10:31AM"
                body={SAMPLE_MESSAGE_BODY}
                thread={{
                  count: 12,
                  avatars: SAMPLE_MEMBERS.slice(0, 3),
                  lastReplyLabel: 'Last today at 2:14PM',
                }}
              />
            </div>
          </Section>

          {/* CHAT — Details panel */}
          <Section title="Chat Details — Channel">
            <div className="bg-background border border-gray-border-light rounded-md p-[20px]">
              <div className="h-[700px]">
                <ChatDetails
                  variant="channel"
                  name="general"
                  description="Org-wide announcement"
                  createdLine={'Auto-created with the organization · Jan 12, 2026'}
                  members={[
                    { member: SAMPLE_MEMBERS[0], tag: 'Lead' },
                    { member: SAMPLE_MEMBERS[1] },
                    { member: SAMPLE_MEMBERS[2] },
                    { member: SAMPLE_MEMBERS[3] },
                  ]}
                  memberCount={108}
                  extraMemberCount={104}
                  pinned={[
                    { id: '1', title: 'Q2 OKR snapshot', meta: 'AI · 2d ago' },
                    { id: '2', title: 'Weekly all-hands recap', meta: 'Daniel · 5d ago' },
                    { id: '3', title: 'Welcome to Stratos', meta: 'Onboarding · Jan 12' },
                  ]}
                  aiCard={{
                    title: 'Catch me up',
                    subtitle:
                      '24 messages since you last checked. Hannah shared the Q2 OKR draft. Daniel proposed an all-hands time change. AI drafted the response.',
                    children: (
                      <Button size="compact" variant="secondary">
                        Read summary
                      </Button>
                    ),
                  }}
                />
              </div>
            </div>
          </Section>

          <Section title="Chat Details — DM">
            <div className="bg-background border border-gray-border-light rounded-md p-[20px]">
              <div className="h-[700px]">
                <ChatDetails
                  variant="dm"
                  member={{ name: 'Mira Chen' }}
                  jobTitle="Senior Engineer"
                  orgName="Strato Labs"
                  sharedSessions={[
                    { id: 's1', name: 'apollo-eng', subtitle: 'Project · Apollo', category: 'project-context' },
                    { id: 's2', name: 'design-crit', subtitle: 'Member group', category: 'references' },
                    { id: 's3', name: 'general', subtitle: 'Org-wide', category: 'decisions' },
                  ]}
                  sharedFiles={[
                    { id: 'f1', name: 'staging-flake.repro.md', meta: 'Today · 12 KB' },
                    { id: 'f2', name: 'token-rotation-notes.txt', meta: 'Yesterday · 8 KB', category: 'references' },
                    { id: 'f3', name: 'cutover-checklist.pdf', meta: 'Apr 24 · 1.4 MB', category: 'project-context' },
                  ]}
                  aiCard={{
                    title: 'Action items inferred',
                    subtitle: '2 items detected from the messages.',
                    children: (
                      <div className="flex flex-col gap-[7px]">
                        <button
                          type="button"
                          className="bg-primary-main text-white text-[12px] rounded-[5px] px-[10px] py-[7px] flex items-center justify-between hover:bg-primary-main/80"
                        >
                          APO-205: Align staging/ prod TTL
                          <span aria-hidden>→</span>
                        </button>
                        <button
                          type="button"
                          className="bg-primary-main text-white text-[12px] rounded-[5px] px-[10px] py-[7px] flex items-center justify-between hover:bg-primary-main/80"
                        >
                          APO-204: Pair review
                          <span aria-hidden>→</span>
                        </button>
                      </div>
                    ),
                  }}
                />
              </div>
            </div>
          </Section>

          {/* CHAT — Sidebar */}
          <Section title="Chat Sidebar (Messages page)">
            <div className="bg-background border border-gray-border-light rounded-md inline-block">
              <div className="h-[820px]">
                <ChatSidebar
                  activeFilter="all"
                  sessionsCount={7}
                  sessionGroups={SAMPLE_CHAT_SESSIONS}
                  dms={SAMPLE_CHAT_DMS}
                  dmCount={5}
                  activeId="general"
                />
              </div>
            </div>
          </Section>

          {/* CHAT — Composer */}
          <Section title="Chat Composer">
            <div className="bg-background border border-gray-border-light rounded-md p-[20px] w-[850px]">
              <ChatComposer
                value=""
                onChange={() => undefined}
                onSend={() => undefined}
                onSchedule={() => undefined}
                placeholder="Message #general"
                scopeChips={
                  <>
                    <ChatComposerChip icon={<ComposerIcons.Sparkle />}>
                      AI on · drafts replies
                    </ChatComposerChip>
                    <ChatComposerChip icon={<ComposerIcons.OrgChart />}>
                      Org-wide · 108 members
                    </ChatComposerChip>
                  </>
                }
              />
            </div>
          </Section>
        </div>
      </main>
    </>
  )
}
