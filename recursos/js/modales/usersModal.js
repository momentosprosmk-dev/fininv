(function () {
  function openUsersModal(opts) {
    var root = document.getElementById('modales-root');
    if (!root) return;

    var esc = window.escapeHTML;
    var state = {
      loading: Boolean(opts.isConnected),
      busy: false,
      users: [],
      error: '',
      success: '',
      showAddForm: false,
      newUsername: '',
      newEmail: '',
      newPassword: '',
      editingRow: null,
      editUsername: '',
      editEmail: '',
      editPassword: '',
      confirmDeleteRow: null,
    };

    function renderPwdField(id, placeholder, val, disabled) {
      return (
        '<div class="pwd-input-wrap">' +
          '<input type="password" id="' + id + '" class="input" placeholder="' + esc(placeholder) + '" value="' + esc(val) + '" ' + (disabled ? 'disabled' : '') + ' />' +
          '<div class="pwd-actions">' +
            '<button type="button" class="pwd-action-btn" data-upwd-clear="' + id + '" title="Borrar" tabindex="-1"><i class="fa-solid fa-xmark"></i></button>' +
            '<button type="button" class="pwd-action-btn" data-upwd-toggle="' + id + '" title="Mostrar u ocultar" tabindex="-1"><i class="fa-regular fa-eye"></i></button>' +
          '</div>' +
        '</div>'
      );
    }

    function render() {
      var prevScrollEl = root.querySelector('.modal-body-scroll');
      var prevScrollTop = prevScrollEl ? prevScrollEl.scrollTop : 0;
      var bodyHtml = '';
      if (!opts.isConnected) {
        bodyHtml =
          '<div class="alert-banner alert-amber" style="margin-bottom:0">' +
            '<i class="fa-solid fa-triangle-exclamation"></i> Conecta primero tu Google Sheet desde <strong>Conectar Gmail / Sheet</strong> para administrar los usuarios.' +
          '</div>';
      } else {
        var addFormHtml =
          '<div class="config-box" style="margin-bottom:1rem">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem">' +
              '<span class="field-label" style="margin:0;color:var(--text-strong)"><i class="fa-solid fa-user-plus text-emerald"></i> Agregar nuevo usuario</span>' +
              '<button type="button" id="um-toggle-add" class="link-btn">' + (state.showAddForm ? 'Ocultar' : '+ Agregar') + '</button>' +
            '</div>' +
            (state.showAddForm
              ? '<div style="margin-top:0.65rem">' +
                  '<div class="form-grid-2" style="margin-bottom:0.5rem">' +
                    '<div><label class="field-label">Nombre de usuario</label><input type="text" id="um-new-user" class="input" placeholder="Ej. esandoval" value="' + esc(state.newUsername) + '" ' + (state.busy ? 'disabled' : '') + ' /></div>' +
                    '<div><label class="field-label">Correo electrónico</label><input type="email" id="um-new-email" class="input" placeholder="correo@gmail.com" value="' + esc(state.newEmail) + '" ' + (state.busy ? 'disabled' : '') + ' /></div>' +
                  '</div>' +
                  '<div class="field-group" style="margin-bottom:0.6rem">' +
                    '<label class="field-label">Contraseña</label>' +
                    renderPwdField('um-new-pwd', 'Contraseña de acceso', state.newPassword, state.busy) +
                  '</div>' +
                  '<button type="button" id="um-add-btn" class="btn btn-primary" style="width:100%" ' + (state.busy ? 'disabled' : '') + '>' +
                    (state.busy ? '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...' : '<i class="fa-solid fa-plus"></i> Guardar nuevo usuario') +
                  '</button>' +
                '</div>'
              : '') +
          '</div>';

        var listHtml = '';
        if (state.loading) {
          listHtml = '<div class="alert-banner alert-indigo"><i class="fa-solid fa-spinner fa-spin"></i> Cargando usuarios...</div>';
        } else if (state.users.length === 0) {
          listHtml = '<p class="text-dim" style="text-align:center;padding:1.25rem 0;font-size:0.85rem">No hay usuarios registrados en este Sheet.</p>';
        } else {
          listHtml = '<div style="display:flex;flex-direction:column;gap:0.6rem">' + state.users.map(function (u) {
            var isEditing = state.editingRow === u.rowIndex;
            var isConfirmDel = state.confirmDeleteRow === u.rowIndex;
            var isCurrentSession = (opts.currentUsername && u.username.toLowerCase() === String(opts.currentUsername).trim().toLowerCase()) ||
              (opts.currentEmail && u.email && u.email.toLowerCase() === String(opts.currentEmail).trim().toLowerCase());
            if (isEditing) {
              return (
                '<div class="config-box" style="border-color:rgba(99,102,241,0.45)">' +
                  '<div class="form-grid-2" style="margin-bottom:0.5rem">' +
                    '<div><label class="field-label">Nombre de usuario</label><input type="text" id="um-edit-user" class="input" value="' + esc(state.editUsername) + '" ' + (state.busy ? 'disabled' : '') + ' /></div>' +
                    '<div><label class="field-label">Correo electrónico</label><input type="email" id="um-edit-email" class="input" value="' + esc(state.editEmail) + '" ' + (state.busy ? 'disabled' : '') + ' /></div>' +
                  '</div>' +
                  '<div class="field-group" style="margin-bottom:0.6rem">' +
                    '<label class="field-label">Nueva contraseña (opcional)</label>' +
                    renderPwdField('um-edit-pwd', 'Dejar vacío para mantener la actual', state.editPassword, state.busy) +
                  '</div>' +
                  '<div style="display:flex;gap:0.5rem;justify-content:flex-end">' +
                    '<button type="button" class="btn btn-secondary" id="um-edit-cancel" ' + (state.busy ? 'disabled' : '') + '>Cancelar</button>' +
                    '<button type="button" class="btn btn-emerald" id="um-edit-save" ' + (state.busy ? 'disabled' : '') + '><i class="fa-solid fa-check"></i> Guardar cambios</button>' +
                  '</div>' +
                '</div>'
              );
            }
            return (
              '<div class="config-item" style="flex-wrap:wrap;gap:0.65rem">' +
                '<div style="flex:1;min-width:180px">' +
                  '<div style="display:flex;align-items:center;gap:0.45rem;font-weight:600;color:var(--text-strong);font-size:0.92rem">' +
                    '<i class="fa-solid fa-user text-indigo"></i><span>' + esc(u.username) + '</span>' +
                    (isCurrentSession ? '<span class="badge badge-indigo" style="font-size:0.68rem">Sesión actual</span>' : '') +
                  '</div>' +
                  '<p style="margin:0.15rem 0 0;font-size:0.8rem;color:var(--text-muted)">' +
                    '<i class="fa-regular fa-envelope" style="margin-right:0.3rem"></i>' + esc(u.email || 'Sin correo registrado') +
                  '</p>' +
                '</div>' +
                (isConfirmDel
                  ? '<div class="inline-confirm">' +
                      '<span class="text-rose" style="font-weight:500">¿Eliminar?</span>' +
                      '<button type="button" class="inline-confirm-btn no" data-um-cancel-del="' + u.rowIndex + '">No</button>' +
                      '<button type="button" class="inline-confirm-btn yes" data-um-confirm-del="' + u.rowIndex + '">Sí</button>' +
                    '</div>'
                  : '<div style="display:flex;gap:0.4rem">' +
                      '<button type="button" class="btn btn-secondary" data-um-edit="' + u.rowIndex + '" style="padding:0.35rem 0.65rem;font-size:0.8rem" ' + (state.busy ? 'disabled' : '') + '><i class="fa-regular fa-pen-to-square"></i> Editar</button>' +
                      (!isCurrentSession
                        ? '<button type="button" class="icon-delete-btn" data-um-ask-del="' + u.rowIndex + '" title="Eliminar usuario" ' + (state.busy ? 'disabled' : '') + '><i class="fa-regular fa-trash-can"></i></button>'
                        : '') +
                    '</div>') +
              '</div>'
            );
          }).join('') + '</div>';
        }

        bodyHtml =
          (state.error ? '<div class="alert-banner alert-rose"><i class="fa-solid fa-triangle-exclamation"></i> ' + esc(state.error) + '</div>' : '') +
          (state.success ? '<div class="alert-banner alert-emerald"><i class="fa-regular fa-circle-check"></i> ' + esc(state.success) + '</div>' : '') +
          addFormHtml +
          '<p class="field-label" style="margin:0 0 0.5rem;color:var(--text-strong)">Usuarios registrados (' + state.users.length + ')</p>' +
          listHtml;
      }

      root.innerHTML =
        '<div class="modal-backdrop">' +
          '<div class="modal-box modal-flex" style="max-width:540px">' +
            '<div class="modal-top-fixed">' +
              '<div class="modal-header" style="margin-bottom:0">' +
                '<div style="display:flex;align-items:center;gap:0.65rem">' +
                  '<div class="brand-icon" style="background:rgba(99,102,241,0.16);color:#818cf8"><i class="fa-solid fa-users-gear"></i></div>' +
                  '<div><h2 class="modal-title">Gestión de Usuarios</h2><p class="modal-subtitle">Administra accesos, correos y contraseñas de tu Sheet</p></div>' +
                '</div>' +
                '<button type="button" class="modal-close" id="um-close"><i class="fa-solid fa-xmark"></i></button>' +
              '</div>' +
            '</div>' +
            '<div class="modal-body-scroll">' + bodyHtml + '</div>' +
            '<div class="modal-bottom-fixed">' +
              '<button type="button" class="btn btn-secondary" id="um-done">Cerrar</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      var closeFn = function () { root.innerHTML = ''; };
      document.getElementById('um-close').addEventListener('click', closeFn);
      document.getElementById('um-done').addEventListener('click', closeFn);

      root.querySelectorAll('[data-upwd-toggle]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var inp = document.getElementById(btn.getAttribute('data-upwd-toggle'));
          if (!inp) return;
          var isPwd = inp.type === 'password';
          inp.type = isPwd ? 'text' : 'password';
          var icon = btn.querySelector('i');
          if (icon) icon.className = isPwd ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
        });
      });
      root.querySelectorAll('[data-upwd-clear]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var inp = document.getElementById(btn.getAttribute('data-upwd-clear'));
          if (!inp || inp.disabled) return;
          inp.value = '';
          inp.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });

      var toggleAddBtn = document.getElementById('um-toggle-add');
      if (toggleAddBtn) {
        toggleAddBtn.addEventListener('click', function () {
          state.showAddForm = !state.showAddForm;
          state.error = '';
          state.success = '';
          render();
        });
      }

      var newU = document.getElementById('um-new-user');
      if (newU) newU.addEventListener('input', function (e) { state.newUsername = e.target.value; });
      var newE = document.getElementById('um-new-email');
      if (newE) newE.addEventListener('input', function (e) { state.newEmail = e.target.value; });
      var newP = document.getElementById('um-new-pwd');
      if (newP) newP.addEventListener('input', function (e) { state.newPassword = e.target.value; });

      var addBtn = document.getElementById('um-add-btn');
      if (addBtn) {
        addBtn.addEventListener('click', async function () {
          if (!state.newUsername.trim() || !state.newPassword) {
            state.error = 'Ingresa el nombre de usuario y la contraseña.';
            state.success = '';
            render();
            return;
          }
          state.busy = true;
          state.error = '';
          state.success = '';
          render();
          var res = await opts.onAddUser({
            username: state.newUsername.trim(),
            email: state.newEmail.trim(),
            password: state.newPassword,
          });
          state.busy = false;
          if (res && res.ok) {
            state.users = res.users || [];
            state.newUsername = '';
            state.newEmail = '';
            state.newPassword = '';
            state.showAddForm = false;
            state.success = 'Usuario agregado correctamente.';
          } else {
            state.error = (res && res.error) || 'No se pudo agregar el usuario.';
          }
          render();
        });
      }

      root.querySelectorAll('[data-um-edit]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var rowIdx = Number(btn.getAttribute('data-um-edit'));
          var target = state.users.find(function (u) { return u.rowIndex === rowIdx; });
          if (!target) return;
          state.editingRow = rowIdx;
          state.editUsername = target.username;
          state.editEmail = target.email;
          state.editPassword = '';
          state.confirmDeleteRow = null;
          state.error = '';
          state.success = '';
          render();
        });
      });

      var editU = document.getElementById('um-edit-user');
      if (editU) editU.addEventListener('input', function (e) { state.editUsername = e.target.value; });
      var editE = document.getElementById('um-edit-email');
      if (editE) editE.addEventListener('input', function (e) { state.editEmail = e.target.value; });
      var editP = document.getElementById('um-edit-pwd');
      if (editP) editP.addEventListener('input', function (e) { state.editPassword = e.target.value; });

      var editCancel = document.getElementById('um-edit-cancel');
      if (editCancel) {
        editCancel.addEventListener('click', function () {
          state.editingRow = null;
          render();
        });
      }

      var editSave = document.getElementById('um-edit-save');
      if (editSave) {
        editSave.addEventListener('click', async function () {
          if (!state.editUsername.trim()) {
            state.error = 'El nombre de usuario no puede estar vacío.';
            render();
            return;
          }
          var orig = state.users.find(function (u) { return u.rowIndex === state.editingRow; });
          state.busy = true;
          state.error = '';
          state.success = '';
          render();
          var res = await opts.onUpdateUser({
            rowIndex: state.editingRow,
            oldUsername: orig ? orig.username : '',
            username: state.editUsername.trim(),
            email: state.editEmail.trim(),
            password: state.editPassword,
          });
          state.busy = false;
          if (res && res.ok) {
            state.users = res.users || [];
            state.editingRow = null;
            state.editPassword = '';
            state.success = 'Usuario actualizado correctamente.';
          } else {
            state.error = (res && res.error) || 'No se pudo actualizar el usuario.';
          }
          render();
        });
      }

      root.querySelectorAll('[data-um-ask-del]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.confirmDeleteRow = Number(btn.getAttribute('data-um-ask-del'));
          state.editingRow = null;
          render();
        });
      });
      root.querySelectorAll('[data-um-cancel-del]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.confirmDeleteRow = null;
          render();
        });
      });
      root.querySelectorAll('[data-um-confirm-del]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var rowIdx = Number(btn.getAttribute('data-um-confirm-del'));
          state.busy = true;
          state.error = '';
          state.success = '';
          render();
          var res = await opts.onDeleteUser(rowIdx);
          state.busy = false;
          state.confirmDeleteRow = null;
          if (res && res.ok) {
            state.users = res.users || [];
            state.success = 'Usuario eliminado correctamente.';
          } else {
            state.error = (res && res.error) || 'No se pudo eliminar el usuario.';
          }
          render();
        });
      });

      var nextScrollEl = root.querySelector('.modal-body-scroll');
      if (nextScrollEl) nextScrollEl.scrollTop = prevScrollTop;
    }

    render();
    if (opts.isConnected && typeof opts.onListUsers === 'function') {
      opts.onListUsers().then(function (res) {
        state.loading = false;
        if (res && res.ok) {
          state.users = res.users || [];
        } else {
          state.error = (res && res.error) || 'No se pudieron cargar los usuarios.';
        }
        render();
      });
    }
  }

  window.openUsersModal = openUsersModal;
})();
