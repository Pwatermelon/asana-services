package com.yoga.dict.data.api;

import retrofit2.Response;
import retrofit2.http.*;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000B\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\bf\u0018\u00002\u00020\u0001J\u001e\u0010\u0002\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0001\u0010\u0005\u001a\u00020\u0006H\u00a7@\u00a2\u0006\u0002\u0010\u0007J\u0014\u0010\b\u001a\b\u0012\u0004\u0012\u00020\t0\u0003H\u00a7@\u00a2\u0006\u0002\u0010\nJ\u001e\u0010\u000b\u001a\b\u0012\u0004\u0012\u00020\f0\u00032\b\b\u0001\u0010\r\u001a\u00020\u000eH\u00a7@\u00a2\u0006\u0002\u0010\u000fJ\u0014\u0010\u0010\u001a\b\u0012\u0004\u0012\u00020\u00040\u0003H\u00a7@\u00a2\u0006\u0002\u0010\nJ\u001e\u0010\u0011\u001a\b\u0012\u0004\u0012\u00020\f0\u00032\b\b\u0001\u0010\r\u001a\u00020\u0012H\u00a7@\u00a2\u0006\u0002\u0010\u0013J\u001e\u0010\u0014\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0001\u0010\r\u001a\u00020\u0015H\u00a7@\u00a2\u0006\u0002\u0010\u0016J\u001e\u0010\u0017\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0001\u0010\u000b\u001a\u00020\u0006H\u00a7@\u00a2\u0006\u0002\u0010\u0007\u00f8\u0001\u0000\u0082\u0002\u0006\n\u0004\b!0\u0001\u00a8\u0006\u0018\u00c0\u0006\u0001"}, d2 = {"Lcom/yoga/dict/data/api/AuthApiService;", "", "confirmRegistration", "Lretrofit2/Response;", "", "token", "", "(Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "getUserInfo", "Lcom/yoga/dict/data/api/UserInfo;", "(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "login", "Lcom/yoga/dict/data/api/AuthResponse;", "request", "Lcom/yoga/dict/data/api/LoginRequest;", "(Lcom/yoga/dict/data/api/LoginRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "logout", "register", "Lcom/yoga/dict/data/api/RegisterRequest;", "(Lcom/yoga/dict/data/api/RegisterRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "resetPasswordConfirm", "Lcom/yoga/dict/data/api/ResetPasswordRequest;", "(Lcom/yoga/dict/data/api/ResetPasswordRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "resetPasswordRequest", "app_debug"})
public abstract interface AuthApiService {
    
    @retrofit2.http.POST(value = "api/auth")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object login(@retrofit2.http.Body()
    @org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.api.LoginRequest request, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.AuthResponse>> $completion);
    
    @retrofit2.http.POST(value = "api/auth/registration")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object register(@retrofit2.http.Body()
    @org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.api.RegisterRequest request, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.AuthResponse>> $completion);
    
    @retrofit2.http.POST(value = "api/auth/logout")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object logout(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<kotlin.Unit>> $completion);
    
    @retrofit2.http.GET(value = "api/auth/reset_password_request")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object resetPasswordRequest(@retrofit2.http.Query(value = "login")
    @org.jetbrains.annotations.NotNull()
    java.lang.String login, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<kotlin.Unit>> $completion);
    
    @retrofit2.http.PATCH(value = "api/auth/reset_password")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object resetPasswordConfirm(@retrofit2.http.Body()
    @org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.api.ResetPasswordRequest request, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<kotlin.Unit>> $completion);
    
    @retrofit2.http.GET(value = "api/auth/verify/{token}")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object confirmRegistration(@retrofit2.http.Path(value = "token")
    @org.jetbrains.annotations.NotNull()
    java.lang.String token, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<kotlin.Unit>> $completion);
    
    @retrofit2.http.GET(value = "api/users/me")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getUserInfo(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.UserInfo>> $completion);
}