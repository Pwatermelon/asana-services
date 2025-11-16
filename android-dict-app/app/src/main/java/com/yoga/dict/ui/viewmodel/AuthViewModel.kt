package com.yoga.dict.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yoga.dict.data.local.AuthPreferences
import com.yoga.dict.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val authPreferences: AuthPreferences
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()
    
    private val _isAuthenticated = MutableStateFlow(false)
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()
    
    private val _userRole = MutableStateFlow<String?>(null)
    val userRole: StateFlow<String?> = _userRole.asStateFlow()
    
    private val _userLogin = MutableStateFlow<String?>(null)
    val userLogin: StateFlow<String?> = _userLogin.asStateFlow()
    
    val isAdmin: Boolean
        get() = _userRole.value == "admin"
    
    val isExpert: Boolean
        get() = _userRole.value == "expert"
    
    val isExpertOrAdmin: Boolean
        get() = isAdmin || isExpert
    
    init {
        checkAuth()
    }
    
    fun checkAuth() {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            authRepository.checkAuth()
                .onSuccess { authCheck ->
                    if (authCheck.is_authenticated && authCheck.role != null) {
                        _isAuthenticated.value = true
                        _userRole.value = authCheck.role
                        authPreferences.setAuthenticated(true)
                        authPreferences.saveUserRole(authCheck.role)
                        
                        // Получаем информацию о пользователе
                        authRepository.getUserInfo()
                            .onSuccess { userInfo ->
                                _userLogin.value = userInfo.login
                                authPreferences.saveUserLogin(userInfo.login)
                            }
                        
                        _uiState.value = AuthUiState.Authenticated
                    } else {
                        _isAuthenticated.value = false
                        _userRole.value = null
                        _uiState.value = AuthUiState.NotAuthenticated
                    }
                }
                .onFailure {
                    _isAuthenticated.value = false
                    _uiState.value = AuthUiState.NotAuthenticated
                }
        }
    }
    
    fun login(username: String, password: String, rememberMe: Boolean = false) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            authRepository.login(username, password, rememberMe)
                .onSuccess { token ->
                    authPreferences.saveToken(token)
                    checkAuth()
                }
                .onFailure { error ->
                    _uiState.value = AuthUiState.Error(error.message ?: "Ошибка входа")
                }
        }
    }
    
    fun register(login: String, mail: String, password: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            authRepository.register(login, mail, password)
                .onSuccess {
                    _uiState.value = AuthUiState.RegistrationSuccess
                }
                .onFailure { error ->
                    _uiState.value = AuthUiState.Error(error.message ?: "Ошибка регистрации")
                }
        }
    }
    
    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            authPreferences.clear()
            _isAuthenticated.value = false
            _userRole.value = null
            _userLogin.value = null
            _uiState.value = AuthUiState.NotAuthenticated
        }
    }
    
    fun resetPasswordRequest(login: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            authRepository.resetPasswordRequest(login)
                .onSuccess {
                    _uiState.value = AuthUiState.ResetPasswordSent
                }
                .onFailure { error ->
                    _uiState.value = AuthUiState.Error(error.message ?: "Ошибка запроса восстановления")
                }
        }
    }
    
    fun resetPasswordConfirm(token: String, password: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            authRepository.resetPasswordConfirm(token, password)
                .onSuccess {
                    _uiState.value = AuthUiState.PasswordResetSuccess
                }
                .onFailure { error ->
                    _uiState.value = AuthUiState.Error(error.message ?: "Ошибка восстановления пароля")
                }
        }
    }
}

sealed class AuthUiState {
    object Idle : AuthUiState()
    object Loading : AuthUiState()
    object Authenticated : AuthUiState()
    object NotAuthenticated : AuthUiState()
    object RegistrationSuccess : AuthUiState()
    object ResetPasswordSent : AuthUiState()
    object PasswordResetSuccess : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}

