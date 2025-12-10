package com.yoga.dict.ui.viewmodel;

import com.yoga.dict.data.repository.ModerationRepository;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;

@ScopeMetadata
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
public final class ModerationViewModel_Factory implements Factory<ModerationViewModel> {
  private final Provider<ModerationRepository> repositoryProvider;

  public ModerationViewModel_Factory(Provider<ModerationRepository> repositoryProvider) {
    this.repositoryProvider = repositoryProvider;
  }

  @Override
  public ModerationViewModel get() {
    return newInstance(repositoryProvider.get());
  }

  public static ModerationViewModel_Factory create(
      Provider<ModerationRepository> repositoryProvider) {
    return new ModerationViewModel_Factory(repositoryProvider);
  }

  public static ModerationViewModel newInstance(ModerationRepository repository) {
    return new ModerationViewModel(repository);
  }
}
