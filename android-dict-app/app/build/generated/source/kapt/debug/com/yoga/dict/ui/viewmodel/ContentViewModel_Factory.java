package com.yoga.dict.ui.viewmodel;

import com.yoga.dict.data.repository.ContentRepository;
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
public final class ContentViewModel_Factory implements Factory<ContentViewModel> {
  private final Provider<ContentRepository> repositoryProvider;

  public ContentViewModel_Factory(Provider<ContentRepository> repositoryProvider) {
    this.repositoryProvider = repositoryProvider;
  }

  @Override
  public ContentViewModel get() {
    return newInstance(repositoryProvider.get());
  }

  public static ContentViewModel_Factory create(Provider<ContentRepository> repositoryProvider) {
    return new ContentViewModel_Factory(repositoryProvider);
  }

  public static ContentViewModel newInstance(ContentRepository repository) {
    return new ContentViewModel(repository);
  }
}
