package com.yoga.dict.data.local;

import android.content.Context;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;

@ScopeMetadata("javax.inject.Singleton")
@QualifierMetadata("dagger.hilt.android.qualifiers.ApplicationContext")
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
public final class AuthPreferences_Factory implements Factory<AuthPreferences> {
  private final Provider<Context> contextProvider;

  public AuthPreferences_Factory(Provider<Context> contextProvider) {
    this.contextProvider = contextProvider;
  }

  @Override
  public AuthPreferences get() {
    return newInstance(contextProvider.get());
  }

  public static AuthPreferences_Factory create(Provider<Context> contextProvider) {
    return new AuthPreferences_Factory(contextProvider);
  }

  public static AuthPreferences newInstance(Context context) {
    return new AuthPreferences(context);
  }
}
