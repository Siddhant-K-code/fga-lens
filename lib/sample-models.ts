/*
 * Authorization models reproduced without modification from OpenFGA Sample Stores:
 * https://github.com/openfga/sample-stores/tree/main/stores
 * Copyright 2022 Okta, Inc. Licensed under Apache-2.0.
 */

export type SampleModel = {
  description: string;
  id: string;
  label: string;
  model: string;
  relationCount: number;
  typeCount: number;
};

const githubModel = `model
  schema 1.1

type user

type team
  relations
    define member: [user, team#member]

type repo
  relations
    define admin: [user, team#member] or repo_admin from owner
    define maintainer: [user, team#member] or admin
    define owner: [organization]
    define reader: [user, team#member] or triager or repo_reader from owner
    define triager: [user, team#member] or writer
    define writer: [user, team#member] or maintainer or repo_writer from owner

type organization
  relations
    define member: [user] or owner
    define owner: [user]
    define repo_admin: [user, organization#member]
    define repo_reader: [user, organization#member]
    define repo_writer: [user, organization#member]
`;

export const googleDriveModel = `model
  schema 1.1

type user

type group
  relations
    define member: [user]

type folder
  relations
    define can_create_file: owner
    define owner: [user]
    define parent: [folder]
    define viewer: [user, user:*, group#member] or owner or viewer from parent

type doc
  relations
    define can_change_owner: owner
    define can_read: viewer or owner or viewer from parent
    define can_share: owner or owner from parent
    define can_write: owner or owner from parent
    define owner: [user]
    define parent: [folder]
    define viewer: [user, user:*, group#member]
`;

const expensesModel = `model
  schema 1.1

type employee
  relations
    define can_manage: manager or can_manage from manager
    define manager: [employee]

type report
  relations
    define approver: can_manage from submitter
    define submitter: [employee]
`;

const iotModel = `model
  schema 1.1

type user

type device_group
  relations
    define it_admin: [user]
    define security_guard: [user]

type device
  relations
    define can_rename_device: it_admin
    define can_view_live_video: it_admin or security_guard
    define can_view_recorded_video: it_admin or security_guard
    define it_admin: [user, device_group#it_admin]
    define security_guard: [user, device_group#security_guard]
`;

const slackModel = `model
  schema 1.1

type user

type workspace
  relations
    define channels_admin: [user] or legacy_admin
    define guest: [user]
    define legacy_admin: [user]
    define member: [user] or legacy_admin or channels_admin

type channel
  relations
    define commenter: [user, workspace#member] or writer
    define parent_workspace: [workspace]
    define writer: [user, workspace#member]
`;

const entitlementsModel = `model
  schema 1.1

type user

type organization
  relations
    define member: [user]

type plan
  relations
    define subscriber: [organization]
    define subscriber_member: member from subscriber

type feature
  relations
    define associated_plan: [plan]
    define can_access: subscriber_member from associated_plan
`;

const customRolesModel = `model
  schema 1.1
type user
type team
  relations
    define member: [user]
type role
  relations
    define assignee: [user,team#member,org#member]
type org
  relations
    define asset_category_creator: [role#assignee] or owner
    define asset_commenter: [role#assignee] or asset_editor
    define asset_creator: [role#assignee] or owner
    define asset_editor: [role#assignee] or owner
    define asset_viewer: [role#assignee] or asset_commenter
    define member: [user] or owner
    define owner: [user]
    define role_assigner: [role#assignee] or owner
    define role_creator: [role#assignee] or owner
    define team_assigner: [role#assignee] or owner
    define team_creator: [role#assignee] or owner
type asset-category
  relations
    define asset_creator: [role#assignee] or asset_creator from org
    define commenter: [role#assignee] or editor or asset_commenter from org
    define editor: [role#assignee] or asset_editor from org
    define org: [org]
    define viewer: [role#assignee] or commenter or asset_viewer from org
type asset
  relations
    define category: [asset-category]
    define comment: [role#assignee] or edit or commenter from category
    define edit: [role#assignee] or editor from category
    define view: [role#assignee] or comment or viewer from category
`;

export const sampleModels: SampleModel[] = [
  {
    description: "Organizations, teams, and repository roles",
    id: "github",
    label: "GitHub",
    model: githubModel,
    relationCount: 12,
    typeCount: 4,
  },
  {
    description: "Folders, documents, and inherited access",
    id: "gdrive",
    label: "Google Drive",
    model: googleDriveModel,
    relationCount: 12,
    typeCount: 4,
  },
  {
    description: "Management chains and report approval",
    id: "expenses",
    label: "Expenses",
    model: expensesModel,
    relationCount: 4,
    typeCount: 2,
  },
  {
    description: "Device groups and operational permissions",
    id: "iot",
    label: "IoT",
    model: iotModel,
    relationCount: 7,
    typeCount: 3,
  },
  {
    description: "Workspaces, channels, and member roles",
    id: "slack",
    label: "Slack",
    model: slackModel,
    relationCount: 7,
    typeCount: 3,
  },
  {
    description: "Plans, features, and subscriber access",
    id: "entitlements",
    label: "Entitlements",
    model: entitlementsModel,
    relationCount: 5,
    typeCount: 4,
  },
  {
    description: "Assignable roles across organizations and assets",
    id: "custom-roles",
    label: "Custom roles",
    model: customRolesModel,
    relationCount: 22,
    typeCount: 6,
  },
];
