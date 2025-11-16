package com.yoga.dict.data.local;

import android.content.Context;
import androidx.datastore.core.DataStore;
import androidx.datastore.preferences.core.Preferences;
import dagger.hilt.android.qualifiers.ApplicationContext;
import kotlinx.coroutines.flow.Flow;
import javax.inject.Inject;
import javax.inject.Singleton;

@javax.inject.Singleton()
@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000.\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0010\u000b\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0002\b\u0006\n\u0002\u0010\u0002\n\u0002\b\f\b\u0007\u0018\u0000 \u001c2\u00020\u0001:\u0001\u001cB\u0011\b\u0007\u0012\b\b\u0001\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004J\u000e\u0010\u0010\u001a\u00020\u0011H\u0086@\u00a2\u0006\u0002\u0010\u0012J\u0010\u0010\u0013\u001a\u0004\u0018\u00010\nH\u0086@\u00a2\u0006\u0002\u0010\u0012J\u0016\u0010\u0014\u001a\u00020\u00112\u0006\u0010\t\u001a\u00020\nH\u0086@\u00a2\u0006\u0002\u0010\u0015J\u0016\u0010\u0016\u001a\u00020\u00112\u0006\u0010\u0017\u001a\u00020\nH\u0086@\u00a2\u0006\u0002\u0010\u0015J\u0016\u0010\u0018\u001a\u00020\u00112\u0006\u0010\u0019\u001a\u00020\nH\u0086@\u00a2\u0006\u0002\u0010\u0015J\u0016\u0010\u001a\u001a\u00020\u00112\u0006\u0010\u0005\u001a\u00020\u0007H\u0086@\u00a2\u0006\u0002\u0010\u001bR\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0017\u0010\u0005\u001a\b\u0012\u0004\u0012\u00020\u00070\u0006\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0005\u0010\bR\u0019\u0010\t\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\n0\u0006\u00a2\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\bR\u0019\u0010\f\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\n0\u0006\u00a2\u0006\b\n\u0000\u001a\u0004\b\r\u0010\bR\u0019\u0010\u000e\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\n0\u0006\u00a2\u0006\b\n\u0000\u001a\u0004\b\u000f\u0010\b\u00a8\u0006\u001d"}, d2 = {"Lcom/yoga/dict/data/local/AuthPreferences;", "", "context", "Landroid/content/Context;", "(Landroid/content/Context;)V", "isAuthenticated", "Lkotlinx/coroutines/flow/Flow;", "", "()Lkotlinx/coroutines/flow/Flow;", "token", "", "getToken", "userLogin", "getUserLogin", "userRole", "getUserRole", "clear", "", "(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "getTokenSync", "saveToken", "(Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "saveUserLogin", "login", "saveUserRole", "role", "setAuthenticated", "(ZLkotlin/coroutines/Continuation;)Ljava/lang/Object;", "Companion", "app_debug"})
public final class AuthPreferences {
    @org.jetbrains.annotations.NotNull()
    private final android.content.Context context = null;
    @org.jetbrains.annotations.NotNull()
    private static final androidx.datastore.preferences.core.Preferences.Key<java.lang.String> TOKEN_KEY = null;
    @org.jetbrains.annotations.NotNull()
    private static final androidx.datastore.preferences.core.Preferences.Key<java.lang.String> USER_ROLE_KEY = null;
    @org.jetbrains.annotations.NotNull()
    private static final androidx.datastore.preferences.core.Preferences.Key<java.lang.String> USER_LOGIN_KEY = null;
    @org.jetbrains.annotations.NotNull()
    private static final androidx.datastore.preferences.core.Preferences.Key<java.lang.Boolean> IS_AUTHENTICATED_KEY = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.Flow<java.lang.String> token = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.Flow<java.lang.String> userRole = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.Flow<java.lang.String> userLogin = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.Flow<java.lang.Boolean> isAuthenticated = null;
    @org.jetbrains.annotations.NotNull()
    public static final com.yoga.dict.data.local.AuthPreferences.Companion Companion = null;
    
    @javax.inject.Inject()
    public AuthPreferences(@dagger.hilt.android.qualifiers.ApplicationContext()
    @org.jetbrains.annotations.NotNull()
    android.content.Context context) {
        super();
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.Flow<java.lang.String> getToken() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.Flow<java.lang.String> getUserRole() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.Flow<java.lang.String> getUserLogin() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.Flow<java.lang.Boolean> isAuthenticated() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Object saveToken(@org.jetbrains.annotations.NotNull()
    java.lang.String token, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super kotlin.Unit> $completion) {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Object saveUserRole(@org.jetbrains.annotations.NotNull()
    java.lang.String role, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super kotlin.Unit> $completion) {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Object saveUserLogin(@org.jetbrains.annotations.NotNull()
    java.lang.String login, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super kotlin.Unit> $completion) {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Object setAuthenticated(boolean isAuthenticated, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super kotlin.Unit> $completion) {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Object clear(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super kotlin.Unit> $completion) {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Object getTokenSync(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super java.lang.String> $completion) {
        return null;
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000 \n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0010\u000b\n\u0002\b\u0003\n\u0002\u0010\u000e\n\u0002\b\u0006\b\u0086\u0003\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002R\u0017\u0010\u0003\u001a\b\u0012\u0004\u0012\u00020\u00050\u0004\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0006\u0010\u0007R\u0017\u0010\b\u001a\b\u0012\u0004\u0012\u00020\t0\u0004\u00a2\u0006\b\n\u0000\u001a\u0004\b\n\u0010\u0007R\u0017\u0010\u000b\u001a\b\u0012\u0004\u0012\u00020\t0\u0004\u00a2\u0006\b\n\u0000\u001a\u0004\b\f\u0010\u0007R\u0017\u0010\r\u001a\b\u0012\u0004\u0012\u00020\t0\u0004\u00a2\u0006\b\n\u0000\u001a\u0004\b\u000e\u0010\u0007\u00a8\u0006\u000f"}, d2 = {"Lcom/yoga/dict/data/local/AuthPreferences$Companion;", "", "()V", "IS_AUTHENTICATED_KEY", "Landroidx/datastore/preferences/core/Preferences$Key;", "", "getIS_AUTHENTICATED_KEY", "()Landroidx/datastore/preferences/core/Preferences$Key;", "TOKEN_KEY", "", "getTOKEN_KEY", "USER_LOGIN_KEY", "getUSER_LOGIN_KEY", "USER_ROLE_KEY", "getUSER_ROLE_KEY", "app_debug"})
    public static final class Companion {
        
        private Companion() {
            super();
        }
        
        @org.jetbrains.annotations.NotNull()
        public final androidx.datastore.preferences.core.Preferences.Key<java.lang.String> getTOKEN_KEY() {
            return null;
        }
        
        @org.jetbrains.annotations.NotNull()
        public final androidx.datastore.preferences.core.Preferences.Key<java.lang.String> getUSER_ROLE_KEY() {
            return null;
        }
        
        @org.jetbrains.annotations.NotNull()
        public final androidx.datastore.preferences.core.Preferences.Key<java.lang.String> getUSER_LOGIN_KEY() {
            return null;
        }
        
        @org.jetbrains.annotations.NotNull()
        public final androidx.datastore.preferences.core.Preferences.Key<java.lang.Boolean> getIS_AUTHENTICATED_KEY() {
            return null;
        }
    }
}