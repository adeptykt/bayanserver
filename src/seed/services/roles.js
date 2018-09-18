
const admin = {
  role: 'admin',
  permissions: [
    'create',
    'read',
    'update',
    'delete',
    'manageUsers',
    'manageRoles',
    'manageSettings',
    'manageOperations'
  ]
}

const basic = {
  role: 'basic',
  permissions: [
    'read'
  ]
}

module.exports = [admin, basic]
