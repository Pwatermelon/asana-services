package com.yoga.dict.ui.viewmodel;

import androidx.lifecycle.ViewModel;
import com.yoga.dict.data.local.AuthPreferences;
import com.yoga.dict.data.repository.AuthRepository;
import dagger.hilt.android.lifecycle.HiltViewModel;
import kotlinx.coroutines.flow.StateFlow;
import javax.inject.Inject;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000.\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\t\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\b6\u0018\u00002\u00020\u0001:\b\u0003\u0004\u0005\u0006\u0007\b\t\nB\u0007\b\u0004\u00a2\u0006\u0002\u0010\u0002\u0082\u0001\b\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u00a8\u0006\u0013"}, d2 = {"Lcom/yoga/dict/ui/viewmodel/AuthUiState;", "", "()V", "Authenticated", "Error", "Idle", "Loading", "NotAuthenticated", "PasswordResetSuccess", "RegistrationSuccess", "ResetPasswordSent", "Lcom/yoga/dict/ui/viewmodel/AuthUiState$Authenticated;", "Lcom/yoga/dict/ui/viewmodel/AuthUiState$Error;", "Lcom/yoga/dict/ui/viewmodel/AuthUiState$Idle;", "Lcom/yoga/dict/ui/viewmodel/AuthUiState$Loading;", "Lcom/yoga/dict/ui/viewmodel/AuthUiState$NotAuthenticated;", "Lcom/yoga/dict/ui/viewmodel/AuthUiState$PasswordResetSuccess;", "Lcom/yoga/dict/ui/viewmodel/AuthUiState$RegistrationSuccess;", "Lcom/yoga/dict/ui/viewmodel/AuthUiState$ResetPasswordSent;", "app_debug"})
public abstract class AuthUiState {
    
    private AuthUiState() {
        super();
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\f\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u00c6\u0002\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002\u00a8\u0006\u0003"}, d2 = {"Lcom/yoga/dict/ui/viewmodel/AuthUiState$Authenticated;", "Lcom/yoga/dict/ui/viewmodel/AuthUiState;", "()V", "app_debug"})
    public static final class Authenticated extends com.yoga.dict.ui.viewmodel.AuthUiState {
        @org.jetbrains.annotations.NotNull()
        public static final com.yoga.dict.ui.viewmodel.AuthUiState.Authenticated INSTANCE = null;
        
        private Authenticated() {
        }
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000&\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0006\n\u0002\u0010\u000b\n\u0000\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\b\n\u0002\b\u0002\b\u0086\b\u0018\u00002\u00020\u0001B\r\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004J\t\u0010\u0007\u001a\u00020\u0003H\u00c6\u0003J\u0013\u0010\b\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u0003H\u00c6\u0001J\u0013\u0010\t\u001a\u00020\n2\b\u0010\u000b\u001a\u0004\u0018\u00010\fH\u00d6\u0003J\t\u0010\r\u001a\u00020\u000eH\u00d6\u0001J\t\u0010\u000f\u001a\u00020\u0003H\u00d6\u0001R\u0011\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0005\u0010\u0006\u00a8\u0006\u0010"}, d2 = {"Lcom/yoga/dict/ui/viewmodel/AuthUiState$Error;", "Lcom/yoga/dict/ui/viewmodel/AuthUiState;", "message", "", "(Ljava/lang/String;)V", "getMessage", "()Ljava/lang/String;", "component1", "copy", "equals", "", "other", "", "hashCode", "", "toString", "app_debug"})
    public static final class Error extends com.yoga.dict.ui.viewmodel.AuthUiState {
        @org.jetbrains.annotations.NotNull()
        private final java.lang.String message = null;
        
        public Error(@org.jetbrains.annotations.NotNull()
        java.lang.String message) {
        }
        
        @org.jetbrains.annotations.NotNull()
        public final java.lang.String getMessage() {
            return null;
        }
        
        @org.jetbrains.annotations.NotNull()
        public final java.lang.String component1() {
            return null;
        }
        
        @org.jetbrains.annotations.NotNull()
        public final com.yoga.dict.ui.viewmodel.AuthUiState.Error copy(@org.jetbrains.annotations.NotNull()
        java.lang.String message) {
            return null;
        }
        
        @java.lang.Override()
        public boolean equals(@org.jetbrains.annotations.Nullable()
        java.lang.Object other) {
            return false;
        }
        
        @java.lang.Override()
        public int hashCode() {
            return 0;
        }
        
        @java.lang.Override()
        @org.jetbrains.annotations.NotNull()
        public java.lang.String toString() {
            return null;
        }
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\f\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u00c6\u0002\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002\u00a8\u0006\u0003"}, d2 = {"Lcom/yoga/dict/ui/viewmodel/AuthUiState$Idle;", "Lcom/yoga/dict/ui/viewmodel/AuthUiState;", "()V", "app_debug"})
    public static final class Idle extends com.yoga.dict.ui.viewmodel.AuthUiState {
        @org.jetbrains.annotations.NotNull()
        public static final com.yoga.dict.ui.viewmodel.AuthUiState.Idle INSTANCE = null;
        
        private Idle() {
        }
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\f\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u00c6\u0002\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002\u00a8\u0006\u0003"}, d2 = {"Lcom/yoga/dict/ui/viewmodel/AuthUiState$Loading;", "Lcom/yoga/dict/ui/viewmodel/AuthUiState;", "()V", "app_debug"})
    public static final class Loading extends com.yoga.dict.ui.viewmodel.AuthUiState {
        @org.jetbrains.annotations.NotNull()
        public static final com.yoga.dict.ui.viewmodel.AuthUiState.Loading INSTANCE = null;
        
        private Loading() {
        }
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\f\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u00c6\u0002\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002\u00a8\u0006\u0003"}, d2 = {"Lcom/yoga/dict/ui/viewmodel/AuthUiState$NotAuthenticated;", "Lcom/yoga/dict/ui/viewmodel/AuthUiState;", "()V", "app_debug"})
    public static final class NotAuthenticated extends com.yoga.dict.ui.viewmodel.AuthUiState {
        @org.jetbrains.annotations.NotNull()
        public static final com.yoga.dict.ui.viewmodel.AuthUiState.NotAuthenticated INSTANCE = null;
        
        private NotAuthenticated() {
        }
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\f\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u00c6\u0002\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002\u00a8\u0006\u0003"}, d2 = {"Lcom/yoga/dict/ui/viewmodel/AuthUiState$PasswordResetSuccess;", "Lcom/yoga/dict/ui/viewmodel/AuthUiState;", "()V", "app_debug"})
    public static final class PasswordResetSuccess extends com.yoga.dict.ui.viewmodel.AuthUiState {
        @org.jetbrains.annotations.NotNull()
        public static final com.yoga.dict.ui.viewmodel.AuthUiState.PasswordResetSuccess INSTANCE = null;
        
        private PasswordResetSuccess() {
        }
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\f\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u00c6\u0002\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002\u00a8\u0006\u0003"}, d2 = {"Lcom/yoga/dict/ui/viewmodel/AuthUiState$RegistrationSuccess;", "Lcom/yoga/dict/ui/viewmodel/AuthUiState;", "()V", "app_debug"})
    public static final class RegistrationSuccess extends com.yoga.dict.ui.viewmodel.AuthUiState {
        @org.jetbrains.annotations.NotNull()
        public static final com.yoga.dict.ui.viewmodel.AuthUiState.RegistrationSuccess INSTANCE = null;
        
        private RegistrationSuccess() {
        }
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\f\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u00c6\u0002\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002\u00a8\u0006\u0003"}, d2 = {"Lcom/yoga/dict/ui/viewmodel/AuthUiState$ResetPasswordSent;", "Lcom/yoga/dict/ui/viewmodel/AuthUiState;", "()V", "app_debug"})
    public static final class ResetPasswordSent extends com.yoga.dict.ui.viewmodel.AuthUiState {
        @org.jetbrains.annotations.NotNull()
        public static final com.yoga.dict.ui.viewmodel.AuthUiState.ResetPasswordSent INSTANCE = null;
        
        private ResetPasswordSent() {
        }
    }
}