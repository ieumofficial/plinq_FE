import type { ReactNode } from 'react'

export type CreateNewType = 'meeting' | 'team' | 'project' | 'task'

type Props = {
  type: CreateNewType
  onClose: () => void
}

function ModalShell({ onClose, children, wide }: { onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal + Close button wrapper */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-start gap-[12px] ${wide ? 'max-h-[90vh]' : ''}`}>
        {/* Modal content */}
        <div
          className={`bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg px-[43px] py-[48px] flex flex-col gap-[22px] overflow-y-auto max-h-[85vh] ${
            wide ? 'w-[1074px]' : 'w-[541px]'
          }`}
        >
          {children}
        </div>

        {/* Close + action buttons column */}
        <div className="flex flex-col gap-[12px] pt-[8px]">
          <button
            type="button"
            onClick={onClose}
            className="w-[45px] h-[45px] bg-black rounded-full flex items-center justify-center cursor-pointer border-0 shrink-0"
          >
            <span className="text-white text-[24px] font-sans font-medium leading-none rotate-45">+</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalTitle({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-[10px] w-full">
      <p className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black">
        {children}
      </p>
      <div className="w-full h-[1px] bg-[#afb1b6]" />
    </div>
  )
}

function TextInput({ placeholder }: { placeholder: string }) {
  return (
    <div className="w-full bg-white border border-[#afb1b6] rounded-[10px] h-[64px] flex items-center px-[12px] py-[13px]">
      <input
        type="text"
        placeholder={placeholder}
        className="w-full bg-transparent outline-none font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black placeholder:text-[#afb1b6]"
      />
    </div>
  )
}

function LabeledInput({ label, placeholder, multiline }: { label: string; placeholder: string; multiline?: boolean }) {
  return (
    <div className="flex flex-col gap-[8px] w-full">
      <p className="font-sans font-medium text-[14px] leading-[20px] tracking-[0.4px] text-[#afb1b6]">
        {label}
      </p>
      {multiline ? (
        <div className="bg-white border border-[#afb1b6] rounded-lg p-[12px] h-[85px]">
          <textarea
            placeholder={placeholder}
            className="w-full h-full bg-transparent outline-none resize-none font-sans font-normal text-[16px] leading-[24px] text-black"
          />
        </div>
      ) : (
        <div className="bg-white border border-[#afb1b6] rounded-lg p-[12px]">
          <input
            type="text"
            placeholder={placeholder}
            className="w-full bg-transparent outline-none font-sans font-normal text-[16px] leading-[24px] text-black"
          />
        </div>
      )}
    </div>
  )
}

function Tag({ children }: { children: string }) {
  return (
    <span className="border border-black h-[16px] flex items-center justify-center px-[8px] py-px font-sans font-medium text-[12px] leading-[normal] tracking-[0.2px] text-black whitespace-nowrap">
      {children}
    </span>
  )
}

function SubmitButton({ children }: { children: string }) {
  return (
    <button
      type="button"
      className="w-full bg-black text-white rounded-[16px] px-[20px] py-[16px] font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] cursor-pointer border-0"
    >
      {children}
    </button>
  )
}

function MeetingMinuteForm({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell onClose={onClose} wide>
      <ModalTitle>Create a new Meeting Minute</ModalTitle>

      <TextInput placeholder="New Meeting" />

      <div className="flex items-center gap-[30px] font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black">
        <span>Date | 2026.04.10 (Fri)</span>
        <span>|</span>
        <span>Time | 08:30AM</span>
      </div>

      <div className="flex items-center gap-[10px]">
        <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black">
          Project | (Dropdown)
        </span>
        <Tag>Project 1</Tag>
      </div>

      <div className="flex items-center gap-[10px]">
        <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black">
          Participants | (Multiselect Dropdown)
        </span>
        <Tag>Minjae X</Tag>
        <Tag>Yeonoh X</Tag>
      </div>

      <div className="flex flex-col gap-[10px] w-full">
        <p className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black">
          Agendas
        </p>
        <div className="bg-white border-2 border-[#afb1b6] rounded-lg p-[15px] w-full">
          <input
            type="text"
            placeholder="Agendas 1"
            className="w-full bg-transparent outline-none font-sans font-normal text-[16px] leading-[24px] tracking-[0.2px] text-black"
          />
        </div>
        <div className="bg-white border-2 border-[#afb1b6] rounded-lg p-[15px] w-full">
          <input
            type="text"
            placeholder="Agendas 2"
            className="w-full bg-transparent outline-none font-sans font-normal text-[16px] leading-[24px] tracking-[0.2px] text-black"
          />
        </div>
      </div>

      <SubmitButton>Save</SubmitButton>
    </ModalShell>
  )
}

function TeamForm({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell onClose={onClose}>
      <ModalTitle>Create a new Team</ModalTitle>

      <TextInput placeholder="New Team Name" />

      <div className="flex items-center gap-[10px]">
        <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black">
          Members | (Multiselect Dropdown)
        </span>
        <Tag>Minjae X</Tag>
        <Tag>Yeonoh X</Tag>
      </div>

      <SubmitButton>Create Team Name</SubmitButton>
    </ModalShell>
  )
}

function ProjectForm({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell onClose={onClose}>
      <ModalTitle>Create a new Project</ModalTitle>

      <TextInput placeholder="New Project Name" />

      <LabeledInput label="Description*" placeholder="Placeholder text for the project" multiline />
      <LabeledInput label="Allocated Budget" placeholder="$0.00" />

      <div className="flex items-center gap-[10px]">
        <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black">
          Lead* | (Multiselect Dropdown)
        </span>
        <Tag>Minjae X</Tag>
        <Tag>Yeonoh X</Tag>
      </div>

      <LabeledInput label="Add members" placeholder="Email Input, or Select from Dropdown" />

      <div className="flex items-center gap-[10px] w-full">
        <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black whitespace-nowrap">
          Knowledge Base* | filename.txt
        </span>
        <button
          type="button"
          className="flex-1 bg-black text-white rounded-[16px] px-[20px] py-[16px] font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] cursor-pointer border-0"
        >
          Upload file
        </button>
      </div>

      <div className="flex items-center gap-[10px]">
        <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black">
          Status | (Dropdown)
        </span>
        <Tag>Planned</Tag>
      </div>

      <SubmitButton>Create Team Name</SubmitButton>
    </ModalShell>
  )
}

function TaskForm({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell onClose={onClose}>
      <ModalTitle>Create a new Task</ModalTitle>

      <TextInput placeholder="New Task" />

      <LabeledInput label="Description*" placeholder="Placeholder text for the project" multiline />
      <LabeledInput label="Due Date" placeholder="Date Input (default: today)" />

      <div className="flex items-center gap-[10px]">
        <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black">
          Priority | (Dropdown)
        </span>
        <Tag>Medium</Tag>
      </div>

      <LabeledInput label="Assignee" placeholder="Search dropdown (single selection)" />

      <div className="flex items-center gap-[10px]">
        <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black">
          Status | (Dropdown)
        </span>
        <Tag>Planned</Tag>
      </div>

      <SubmitButton>Create Task</SubmitButton>
    </ModalShell>
  )
}

export default function CreateNewModal({ type, onClose }: Props) {
  switch (type) {
    case 'meeting':
      return <MeetingMinuteForm onClose={onClose} />
    case 'team':
      return <TeamForm onClose={onClose} />
    case 'project':
      return <ProjectForm onClose={onClose} />
    case 'task':
      return <TaskForm onClose={onClose} />
  }
}
