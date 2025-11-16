package com.yoga.dict.data.repository;

import com.yoga.dict.data.api.AuthApiService;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;

@ScopeMetadata("javax.inject.Singleton")
@QualifierMetadata
@DaggerGenerated
@Generated(
    value = "dagger.internal.codegen.ComponentProcessor",
    comments = "https://dagger.dev"
)
@SuppressWarnings({
    "unchecked",
    "rawtypes",
    "KotlinInternal",
    "KotlinInternalInJava"
})
public final class AuthRepository_Factory implements Factory<AuthRepository> {
  private final Provider<AuthApiService> authApiProvider;

  public AuthRepository_Factory(Provider<AuthApiService> authApiProvider) {
    this.authApiProvider = authApiProvider;
  }

  @Override
  public AuthRepository get() {
    return newInstance(authApiProvider.get());
  }

  public static AuthRepository_Factory create(Provider<AuthApiService> authApiProvider) {
    return new AuthRepository_Factory(authApiProvider);
  }

  public static AuthRepository newInstance(AuthApiService authApi) {
    return new AuthRepository(authApi);
  }
}
