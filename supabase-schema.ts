Initialising login role...
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_conversations: {
        Row: {
          created_at: string
          id: string
          project_id: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["agent_message_role"]
          tokens_used: number | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["agent_message_role"]
          tokens_used?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["agent_message_role"]
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_proposals: {
        Row: {
          applied_item_ids: Json | null
          applied_result: Json | null
          conversation_id: string | null
          created_at: string
          expires_at: string
          id: string
          items: Json
          kind: Database["public"]["Enums"]["agent_proposal_kind"]
          project_id: string | null
          user_id: string
        }
        Insert: {
          applied_item_ids?: Json | null
          applied_result?: Json | null
          conversation_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          items: Json
          kind: Database["public"]["Enums"]["agent_proposal_kind"]
          project_id?: string | null
          user_id: string
        }
        Update: {
          applied_item_ids?: Json | null
          applied_result?: Json | null
          conversation_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          items?: Json
          kind?: Database["public"]["Enums"]["agent_proposal_kind"]
          project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_proposals_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_proposals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_reflections: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          importance: number
          reflection_type: Database["public"]["Enums"]["reflection_type"]
          scope: Database["public"]["Enums"]["agent_scope"]
          scope_id: string
          valid_from: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          importance?: number
          reflection_type: Database["public"]["Enums"]["reflection_type"]
          scope: Database["public"]["Enums"]["agent_scope"]
          scope_id: string
          valid_from?: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          importance?: number
          reflection_type?: Database["public"]["Enums"]["reflection_type"]
          scope?: Database["public"]["Enums"]["agent_scope"]
          scope_id?: string
          valid_from?: string
        }
        Relationships: []
      }
      chat_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          edited_at: string | null
          id: string
          pinned_at: string | null
          pinned_by: string | null
          reply_to_id: string | null
          session_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          session_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_session_members: {
        Row: {
          joined_at: string
          last_read_at: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          last_read_at?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          last_read_at?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_session_members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_session_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          dm_user_a: string | null
          dm_user_b: string | null
          id: string
          kind: Database["public"]["Enums"]["chat_session_kind"]
          name: string | null
          org_id: string
          privacy: Database["public"]["Enums"]["chat_session_privacy"]
          project_id: string | null
          scope: Database["public"]["Enums"]["chat_session_scope"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          dm_user_a?: string | null
          dm_user_b?: string | null
          id?: string
          kind: Database["public"]["Enums"]["chat_session_kind"]
          name?: string | null
          org_id: string
          privacy?: Database["public"]["Enums"]["chat_session_privacy"]
          project_id?: string | null
          scope: Database["public"]["Enums"]["chat_session_scope"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          dm_user_a?: string | null
          dm_user_b?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["chat_session_kind"]
          name?: string | null
          org_id?: string
          privacy?: Database["public"]["Enums"]["chat_session_privacy"]
          project_id?: string | null
          scope?: Database["public"]["Enums"]["chat_session_scope"]
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_dm_user_a_fkey"
            columns: ["dm_user_a"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_dm_user_b_fkey"
            columns: ["dm_user_b"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_columns: {
        Row: {
          id: string
          name: string
          order: number
          project_id: string
        }
        Insert: {
          id?: string
          name: string
          order?: number
          project_id: string
        }
        Update: {
          id?: string
          name?: string
          order?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_columns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_text: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          project_id: string
          source_id: string
          source_type: Database["public"]["Enums"]["chunk_source_type"]
        }
        Insert: {
          chunk_text: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          project_id: string
          source_id: string
          source_type: Database["public"]["Enums"]["chunk_source_type"]
        }
        Update: {
          chunk_text?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          project_id?: string
          source_id?: string
          source_type?: Database["public"]["Enums"]["chunk_source_type"]
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          file_type: string | null
          file_url: string | null
          id: string
          name: string
          project_id: string
          source: Database["public"]["Enums"]["knowledge_source"]
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          file_type?: string | null
          file_url?: string | null
          id?: string
          name: string
          project_id: string
          source?: Database["public"]["Enums"]["knowledge_source"]
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          file_type?: string | null
          file_url?: string | null
          id?: string
          name?: string
          project_id?: string
          source?: Database["public"]["Enums"]["knowledge_source"]
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_agendas: {
        Row: {
          generated_by_ai: boolean
          id: string
          meeting_id: string
          order: number
          summary: string | null
          title: string
        }
        Insert: {
          generated_by_ai?: boolean
          id?: string
          meeting_id: string
          order?: number
          summary?: string | null
          title: string
        }
        Update: {
          generated_by_ai?: boolean
          id?: string
          meeting_id?: string
          order?: number
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agendas_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendees: {
        Row: {
          attendance: Database["public"]["Enums"]["attendance_status"]
          meeting_id: string
          user_id: string
        }
        Insert: {
          attendance?: Database["public"]["Enums"]["attendance_status"]
          meeting_id: string
          user_id: string
        }
        Update: {
          attendance?: Database["public"]["Enums"]["attendance_status"]
          meeting_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_decisions: {
        Row: {
          content: string
          created_at: string
          decided_by: string | null
          id: string
          meeting_id: string
        }
        Insert: {
          content: string
          created_at?: string
          decided_by?: string | null
          id?: string
          meeting_id: string
        }
        Update: {
          content?: string
          created_at?: string
          decided_by?: string | null
          id?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_decisions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_invites: {
        Row: {
          consumed_at: string | null
          consumed_by: string | null
          email: string
          id: string
          invited_at: string
          invited_by: string
          meeting_id: string
        }
        Insert: {
          consumed_at?: string | null
          consumed_by?: string | null
          email: string
          id?: string
          invited_at?: string
          invited_by: string
          meeting_id: string
        }
        Update: {
          consumed_at?: string | null
          consumed_by?: string | null
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_invites_consumed_by_fkey"
            columns: ["consumed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_invites_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_minutes: {
        Row: {
          full_text: string | null
          id: string
          meeting_id: string
          processed_at: string | null
          raw_audio_url: string | null
          summary: string | null
        }
        Insert: {
          full_text?: string | null
          id?: string
          meeting_id: string
          processed_at?: string | null
          raw_audio_url?: string | null
          summary?: string | null
        }
        Update: {
          full_text?: string | null
          id?: string
          meeting_id?: string
          processed_at?: string | null
          raw_audio_url?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_minutes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string
          duration_min: number
          id: string
          location_or_url: string | null
          meeting_type: Database["public"]["Enums"]["meeting_type"]
          name: string
          project_id: string
          recurrence: Database["public"]["Enums"]["meeting_recurrence"]
          recurrence_group_id: string | null
          recurrence_until: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["meeting_status"]
        }
        Insert: {
          created_at?: string
          created_by: string
          duration_min?: number
          id?: string
          location_or_url?: string | null
          meeting_type?: Database["public"]["Enums"]["meeting_type"]
          name: string
          project_id: string
          recurrence?: Database["public"]["Enums"]["meeting_recurrence"]
          recurrence_group_id?: string | null
          recurrence_until?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["meeting_status"]
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_min?: number
          id?: string
          location_or_url?: string | null
          meeting_type?: Database["public"]["Enums"]["meeting_type"]
          name?: string
          project_id?: string
          recurrence?: Database["public"]["Enums"]["meeting_recurrence"]
          recurrence_group_id?: string | null
          recurrence_until?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["meeting_status"]
        }
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          joined_at: string
          org_id: string
          permissions: Json
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          joined_at?: string
          org_id: string
          permissions?: Json
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          joined_at?: string
          org_id?: string
          permissions?: Json
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invites: {
        Row: {
          consumed_at: string | null
          consumed_by: string | null
          email: string
          id: string
          invited_at: string
          invited_by: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
        }
        Insert: {
          consumed_at?: string | null
          consumed_by?: string | null
          email: string
          id?: string
          invited_at?: string
          invited_by: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
        }
        Update: {
          consumed_at?: string | null
          consumed_by?: string | null
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
        }
        Relationships: [
          {
            foreignKeyName: "project_invites_consumed_by_fkey"
            columns: ["consumed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Insert: {
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Update: {
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          color: string
          created_at: string
          description: string | null
          id: string
          lead_id: string | null
          name: string
          status: Database["public"]["Enums"]["project_status"]
          team_id: string | null
        }
        Insert: {
          budget?: number | null
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          team_id?: string | null
        }
        Update: {
          budget?: number | null
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          assigned_at: string
          assigned_by: string
          role: Database["public"]["Enums"]["task_assignee_role"]
          task_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          role?: Database["public"]["Enums"]["task_assignee_role"]
          task_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          role?: Database["public"]["Enums"]["task_assignee_role"]
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          kanban_column_id: string | null
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string | null
          source_meeting_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          kanban_column_id?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          source_meeting_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          kanban_column_id?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          source_meeting_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tasks_source_meeting"
            columns: ["source_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_kanban_column_id_fkey"
            columns: ["kanban_column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Insert: {
          role?: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Update: {
          role?: Database["public"]["Enums"]["team_role"]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          description: string | null
          id: string
          name: string
          org_id: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
          org_id: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_segments: {
        Row: {
          end_time: number
          id: string
          meeting_id: string
          speaker_id: string | null
          start_time: number
          text: string
        }
        Insert: {
          end_time: number
          id?: string
          meeting_id: string
          speaker_id?: string | null
          start_time: number
          text: string
        }
        Update: {
          end_time?: number
          id?: string
          meeting_id?: string
          speaker_id?: string | null
          start_time?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_segments_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcript_segments_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          job_title: string | null
          language: string
          last_name: string
          nickname: string | null
          notification_settings: Json
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id: string
          job_title?: string | null
          language?: string
          last_name: string
          nickname?: string | null
          notification_settings?: Json
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          job_title?: string | null
          language?: string
          last_name?: string
          nickname?: string | null
          notification_settings?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_email_exists: { Args: { check_email: string }; Returns: boolean }
      complete_registration: {
        Args: {
          p_first_name: string
          p_job_title?: string
          p_last_name: string
          p_nickname?: string
        }
        Returns: undefined
      }
      get_my_lead_project_ids: { Args: never; Returns: string[] }
      get_my_org_ids: { Args: never; Returns: string[] }
      get_my_org_member_ids: { Args: never; Returns: string[] }
      get_my_project_ids: { Args: never; Returns: string[] }
      process_pending_invites_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      agent_message_role: "user" | "assistant" | "system" | "tool"
      agent_proposal_kind:
        | "tasks"
        | "project_outline"
        | "meeting_agenda"
        | "assignee"
        | "meeting"
      agent_scope: "user" | "project"
      attendance_status: "invited" | "attended" | "absent"
      chat_session_kind: "channel" | "dm"
      chat_session_privacy: "public" | "private"
      chat_session_scope: "org_wide" | "project" | "member_group" | "dm"
      chunk_source_type:
        | "document"
        | "meeting_minutes"
        | "transcript"
        | "task"
        | "decision"
      knowledge_source: "uploaded" | "meeting" | "auto_generated"
      meeting_recurrence: "once" | "every_day" | "every_week" | "every_year"
      meeting_status: "planned" | "recording" | "processed"
      meeting_type: "planning" | "check_in" | "review" | "retrospective"
      org_role: "owner" | "admin" | "member"
      project_role: "editor" | "admin" | "readonly"
      project_status: "planned" | "in_progress" | "review" | "blocked" | "done"
      reflection_type: "status_summary" | "blocker" | "pattern" | "preference"
      task_assignee_role: "owner" | "contributor" | "reviewer"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "planned" | "in_progress" | "review" | "done" | "blocked"
      team_role: "lead" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_message_role: ["user", "assistant", "system", "tool"],
      agent_proposal_kind: [
        "tasks",
        "project_outline",
        "meeting_agenda",
        "assignee",
        "meeting",
      ],
      agent_scope: ["user", "project"],
      attendance_status: ["invited", "attended", "absent"],
      chat_session_kind: ["channel", "dm"],
      chat_session_privacy: ["public", "private"],
      chat_session_scope: ["org_wide", "project", "member_group", "dm"],
      chunk_source_type: [
        "document",
        "meeting_minutes",
        "transcript",
        "task",
        "decision",
      ],
      knowledge_source: ["uploaded", "meeting", "auto_generated"],
      meeting_recurrence: ["once", "every_day", "every_week", "every_year"],
      meeting_status: ["planned", "recording", "processed"],
      meeting_type: ["planning", "check_in", "review", "retrospective"],
      org_role: ["owner", "admin", "member"],
      project_role: ["editor", "admin", "readonly"],
      project_status: ["planned", "in_progress", "review", "blocked", "done"],
      reflection_type: ["status_summary", "blocker", "pattern", "preference"],
      task_assignee_role: ["owner", "contributor", "reviewer"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["planned", "in_progress", "review", "done", "blocked"],
      team_role: ["lead", "member"],
    },
  },
} as const
<claude-code-hint v="1" type="plugin" value="supabase@claude-plugins-official" />
