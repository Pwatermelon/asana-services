package com.yoga.dict.ui.viewmodel;

import androidx.lifecycle.ViewModel;
import com.yoga.dict.data.local.AuthPreferences;
import com.yoga.dict.data.repository.AuthRepository;
import dagger.hilt.android.lifecycle.HiltViewModel;
import kotlinx.coroutines.flow.StateFlow;
import javax.inject.Inject;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000@\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0010\u000b\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0004\n\u0002\u0018\u0002\n\u0002\b\n\n\u0002\u0010\u0002\n\u0002\b\u000b\b\u0007\u0018\u00002\u00020\u0001B\u0017\b\u0007\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005\u00a2\u0006\u0002\u0010\u0006J\u0006\u0010\u001c\u001a\u00020\u001dJ \u0010\u001e\u001a\u00020\u001d2\u0006\u0010\u001f\u001a\u00020\r2\u0006\u0010 \u001a\u00020\r2\b\b\u0002\u0010!\u001a\u00020\tJ\u0006\u0010\"\u001a\u00020\u001dJ\u001e\u0010#\u001a\u00020\u001d2\u0006\u0010\u001e\u001a\u00020\r2\u0006\u0010$\u001a\u00020\r2\u0006\u0010 \u001a\u00020\rJ\u0016\u0010%\u001a\u00020\u001d2\u0006\u0010&\u001a\u00020\r2\u0006\u0010 \u001a\u00020\rJ\u000e\u0010\'\u001a\u00020\u001d2\u0006\u0010\u001e\u001a\u00020\rR\u0014\u0010\u0007\u001a\b\u0012\u0004\u0012\u00020\t0\bX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0014\u0010\n\u001a\b\u0012\u0004\u0012\u00020\u000b0\bX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0016\u0010\f\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\r0\bX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0016\u0010\u000e\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\r0\bX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0004\u001a\u00020\u0005X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0011\u0010\u000f\u001a\u00020\t8F\u00a2\u0006\u0006\u001a\u0004\b\u000f\u0010\u0010R\u0017\u0010\u0011\u001a\b\u0012\u0004\u0012\u00020\t0\u0012\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0011\u0010\u0013R\u0011\u0010\u0014\u001a\u00020\t8F\u00a2\u0006\u0006\u001a\u0004\b\u0014\u0010\u0010R\u0011\u0010\u0015\u001a\u00020\t8F\u00a2\u0006\u0006\u001a\u0004\b\u0015\u0010\u0010R\u0017\u0010\u0016\u001a\b\u0012\u0004\u0012\u00020\u000b0\u0012\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0017\u0010\u0013R\u0019\u0010\u0018\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\r0\u0012\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0019\u0010\u0013R\u0019\u0010\u001a\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\r0\u0012\u00a2\u0006\b\n\u0000\u001a\u0004\b\u001b\u0010\u0013\u00a8\u0006("}, d2 = {"Lcom/yoga/dict/ui/viewmodel/AuthViewModel;", "Landroidx/lifecycle/ViewModel;", "authRepository", "Lcom/yoga/dict/data/repository/AuthRepository;", "authPreferences", "Lcom/yoga/dict/data/local/AuthPreferences;", "(Lcom/yoga/dict/data/repository/AuthRepository;Lcom/yoga/dict/data/local/AuthPreferences;)V", "_isAuthenticated", "Lkotlinx/coroutines/flow/MutableStateFlow;", "", "_uiState", "Lcom/yoga/dict/ui/viewmodel/AuthUiState;", "_userLogin", "", "_userRole", "isAdmin", "()Z", "isAuthenticated", "Lkotlinx/coroutines/flow/StateFlow;", "()Lkotlinx/coroutines/flow/StateFlow;", "isExpert", "isExpertOrAdmin", "uiState", "getUiState", "userLogin", "getUserLogin", "userRole", "getUserRole", "checkAuth", "", "login", "username", "password", "rememberMe", "logout", "register", "mail", "resetPasswordConfirm", "token", "resetPasswordRequest", "app_debug"})
@dagger.hilt.android.lifecycle.HiltViewModel()
public final class AuthViewModel extends androidx.lifecycle.ViewModel {
    @org.jetbrains.annotations.NotNull()
    private final com.yoga.dict.data.repository.AuthRepository authRepository = null;
    @org.jetbrains.annotations.NotNull()
    private final com.yoga.dict.data.local.AuthPreferences authPreferences = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<com.yoga.dict.ui.viewmodel.AuthUiState> _uiState = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<com.yoga.dict.ui.viewmodel.AuthUiState> uiState = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<java.lang.Boolean> _isAuthenticated = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<java.lang.Boolean> isAuthenticated = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<java.lang.String> _userRole = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<java.lang.String> userRole = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<java.lang.String> _userLogin = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<java.lang.String> userLogin = null;
    
    @javax.inject.Inject()
    public AuthViewModel(@org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.repository.AuthRepository authRepository, @org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.local.AuthPreferences authPreferences) {
        super();
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<com.yoga.dict.ui.viewmodel.AuthUiState> getUiState() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<java.lang.Boolean> isAuthenticated() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<java.lang.String> getUserRole() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<java.lang.String> getUserLogin() {
        return null;
    }
    
    public final boolean isAdmin() {
        return false;
    }
    
    public final boolean isExpert() {
        return false;
    }
    
    public final boolean isExpertOrAdmin() {
        return false;
    }
    
    public final void checkAuth() {
    }
    
    public final void login(@org.jetbrains.annotations.NotNull()
    java.lang.String username, @org.jetbrains.annotations.NotNull()
    java.lang.String password, boolean rememberMe) {
    }
    
    public final void register(@org.jetbrains.annotations.NotNull()
    java.lang.String login, @org.jetbrains.annotations.NotNull()
    java.lang.String mail, @org.jetbrains.annotations.NotNull()
    java.lang.String password) {
    }
    
    public final void logout() {
    }
    
    public final void resetPasswordRequest(@org.jetbrains.annotations.NotNull()
    java.lang.String login) {
    }
    
    public final void resetPasswordConfirm(@org.jetbrains.annotations.NotNull()
    java.lang.String token, @org.jetbrains.annotations.NotNull()
    java.lang.String password) {
    }
}