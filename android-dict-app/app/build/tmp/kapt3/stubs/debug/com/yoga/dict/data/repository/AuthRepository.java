package com.yoga.dict.data.repository;

import com.yoga.dict.data.api.AuthApiService;
import com.yoga.dict.data.api.AuthCheckResponse;
import com.yoga.dict.data.api.UserInfo;
import com.yoga.dict.data.api.LoginRequest;
import com.yoga.dict.data.api.RegisterRequest;
import com.yoga.dict.data.api.ResetPasswordRequest;
import javax.inject.Inject;
import javax.inject.Singleton;

@javax.inject.Singleton()
@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000<\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0010\u000b\n\u0002\b\u000e\b\u0007\u0018\u00002\u00020\u0001B\u000f\b\u0007\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004J\u001c\u0010\u0005\u001a\b\u0012\u0004\u0012\u00020\u00070\u0006H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\b\u0010\tJ$\u0010\n\u001a\b\u0012\u0004\u0012\u00020\u000b0\u00062\u0006\u0010\f\u001a\u00020\rH\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u000e\u0010\u000fJ\u001c\u0010\u0010\u001a\b\u0012\u0004\u0012\u00020\u00110\u0006H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u0012\u0010\tJ6\u0010\u0013\u001a\b\u0012\u0004\u0012\u00020\r0\u00062\u0006\u0010\u0014\u001a\u00020\r2\u0006\u0010\u0015\u001a\u00020\r2\b\b\u0002\u0010\u0016\u001a\u00020\u0017H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u0018\u0010\u0019J\u001c\u0010\u001a\u001a\b\u0012\u0004\u0012\u00020\u000b0\u0006H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u001b\u0010\tJ4\u0010\u001c\u001a\b\u0012\u0004\u0012\u00020\u000b0\u00062\u0006\u0010\u0013\u001a\u00020\r2\u0006\u0010\u001d\u001a\u00020\r2\u0006\u0010\u0015\u001a\u00020\rH\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u001e\u0010\u001fJ,\u0010 \u001a\b\u0012\u0004\u0012\u00020\u000b0\u00062\u0006\u0010\f\u001a\u00020\r2\u0006\u0010\u0015\u001a\u00020\rH\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b!\u0010\"J$\u0010#\u001a\b\u0012\u0004\u0012\u00020\u000b0\u00062\u0006\u0010\u0013\u001a\u00020\rH\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b$\u0010\u000fR\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000\u0082\u0002\u000b\n\u0002\b!\n\u0005\b\u00a1\u001e0\u0001\u00a8\u0006%"}, d2 = {"Lcom/yoga/dict/data/repository/AuthRepository;", "", "authApi", "Lcom/yoga/dict/data/api/AuthApiService;", "(Lcom/yoga/dict/data/api/AuthApiService;)V", "checkAuth", "Lkotlin/Result;", "Lcom/yoga/dict/data/api/AuthCheckResponse;", "checkAuth-IoAF18A", "(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "confirmRegistration", "", "token", "", "confirmRegistration-gIAlu-s", "(Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "getUserInfo", "Lcom/yoga/dict/data/api/UserInfo;", "getUserInfo-IoAF18A", "login", "username", "password", "rememberMe", "", "login-BWLJW6A", "(Ljava/lang/String;Ljava/lang/String;ZLkotlin/coroutines/Continuation;)Ljava/lang/Object;", "logout", "logout-IoAF18A", "register", "mail", "register-BWLJW6A", "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "resetPasswordConfirm", "resetPasswordConfirm-0E7RQCE", "(Ljava/lang/String;Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "resetPasswordRequest", "resetPasswordRequest-gIAlu-s", "app_debug"})
public final class AuthRepository {
    @org.jetbrains.annotations.NotNull()
    private final com.yoga.dict.data.api.AuthApiService authApi = null;
    
    @javax.inject.Inject()
    public AuthRepository(@org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.api.AuthApiService authApi) {
        super();
    }
}