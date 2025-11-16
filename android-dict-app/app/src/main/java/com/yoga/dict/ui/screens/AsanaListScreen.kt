package com.yoga.dict.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.yoga.dict.data.model.Asana
import com.yoga.dict.ui.viewmodel.AsanaViewModel
import com.yoga.dict.ui.viewmodel.AsanaUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AsanaListScreen(
    viewModel: AsanaViewModel = hiltViewModel(),
    onAsanaClick: (Asana) -> Unit,
    onNavigateToSources: () -> Unit = {},
    onNavigateToSettings: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val asanaList by viewModel.asanaList.collectAsStateWithLifecycle()
    val searchQuery by viewModel.searchQuery.collectAsStateWithLifecycle()
    
    var showSearchBar by remember { mutableStateOf(false) }
    var showContextMenu by remember { mutableStateOf<Asana?>(null) }
    var contextMenuPosition by remember { mutableStateOf(0 to 0) }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Каталог Асан") },
                actions = {
                    IconButton(onClick = { showSearchBar = !showSearchBar }) {
                        Icon(Icons.Default.Search, contentDescription = "Поиск")
                    }
                    IconButton(onClick = { viewModel.loadAsanas() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Обновить")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { /* TODO: Добавить асану */ },
                containerColor = MaterialTheme.colorScheme.tertiary
            ) {
                Icon(Icons.Default.Add, contentDescription = "Добавить")
            }
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = true,
                    onClick = { },
                    icon = { Icon(Icons.Default.List, null) },
                    label = { Text("Асаны") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onNavigateToSources,
                    icon = { Icon(Icons.Default.Book, null) },
                    label = { Text("Источники") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onNavigateToSettings,
                    icon = { Icon(Icons.Default.Settings, null) },
                    label = { Text("Настройки") }
                )
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Поиск
            if (showSearchBar) {
                SearchBar(
                    query = searchQuery,
                    onQueryChange = { viewModel.searchAsanas(it) },
                    onClose = { 
                        showSearchBar = false
                        viewModel.clearFilters()
                    },
                    modifier = Modifier.fillMaxWidth()
                )
            }
            
            // Алфавитная навигация
            AlphabetBar(
                onLetterClick = { viewModel.filterByLetter(it) },
                modifier = Modifier.fillMaxWidth()
            )
            
            // Список асан
            when (uiState) {
                is AsanaUiState.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                is AsanaUiState.Error -> {
                    val errorState = uiState as AsanaUiState.Error
                    ErrorMessage(
                        message = errorState.message,
                        onRetry = { viewModel.loadAsanas() }
                    )
                }
                is AsanaUiState.Success -> {
                    AsanaList(
                        asanas = asanaList,
                        onAsanaClick = onAsanaClick,
                        onLongPress = { asana, position ->
                            showContextMenu = asana
                            contextMenuPosition = position
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
        }
    }
    
    // Контекстное меню
    showContextMenu?.let { asana ->
        ContextMenu(
            asana = asana,
            position = contextMenuPosition,
            onDismiss = { showContextMenu = null },
            onShare = { /* TODO */ },
            onFavorite = { /* TODO */ },
            onViewDetails = { 
                showContextMenu = null
                onAsanaClick(asana)
            }
        )
    }
}

@Composable
fun AsanaList(
    asanas: List<Asana>,
    onAsanaClick: (Asana) -> Unit,
    onLongPress: (Asana, Pair<Int, Int>) -> Unit,
    modifier: Modifier = Modifier
) {
    val listState = rememberLazyListState()
    
    LazyColumn(
        state = listState,
        modifier = modifier,
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(asanas, key = { it.id }) { asana ->
            AsanaCard(
                asana = asana,
                onClick = { onAsanaClick(asana) },
                onLongPress = { x, y -> onLongPress(asana, x to y) },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
fun AsanaCard(
    asana: Asana,
    onClick: () -> Unit,
    onLongPress: (Int, Int) -> Unit,
    modifier: Modifier = Modifier
) {
    var isPressed by remember { mutableStateOf(false) }
    
    Card(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .pointerInput(Unit) {
                detectTapGestures(
                    onLongPress = { offset ->
                        onLongPress(offset.x.toInt(), offset.y.toInt())
                        isPressed = true
                    },
                    onTap = { onClick() }
                )
            },
        elevation = CardDefaults.cardElevation(
            defaultElevation = if (isPressed) 8.dp else 4.dp
        ),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Фото асаны
            asana.photos.firstOrNull()?.let { photo ->
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(photo.url)
                        .crossfade(true)
                        .build(),
                    contentDescription = asana.name.displayName,
                    modifier = Modifier
                        .size(80.dp)
                        .clip(RoundedCornerShape(12.dp)),
                    contentScale = ContentScale.Crop
                )
            } ?: Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.Image,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            // Информация
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = asana.name.displayName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                
                asana.name.name_sanskrit?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                
                asana.sources.firstOrNull()?.let { source ->
                    Text(
                        text = source.displayName,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
            
            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun SearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.padding(16.dp),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                Icons.Default.Search,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            TextField(
                value = query,
                onValueChange = onQueryChange,
                modifier = Modifier.weight(1f),
                placeholder = { Text("Поиск асан...") },
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent
                ),
                singleLine = true
            )
            
            IconButton(onClick = onClose) {
                Icon(Icons.Default.Close, contentDescription = "Закрыть")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlphabetBar(
    onLetterClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val letters = ('А'..'Я').map { it.toString() }
    
    Row(
        modifier = modifier
            .padding(horizontal = 8.dp, vertical = 8.dp)
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        letters.forEach { letter ->
            FilterChip(
                selected = false,
                onClick = { onLetterClick(letter) },
                label = { Text(letter, style = MaterialTheme.typography.labelSmall) }
            )
        }
    }
}

@Composable
fun ErrorMessage(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Default.Error,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.error
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onRetry) {
            Text("Повторить")
        }
    }
}

@Composable
fun ContextMenu(
    asana: Asana,
    position: Pair<Int, Int>,
    onDismiss: () -> Unit,
    onShare: () -> Unit,
    onFavorite: () -> Unit,
    onViewDetails: () -> Unit
) {
    // Простое контекстное меню через AlertDialog
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(asana.name.displayName) },
        text = {
            Column {
                TextButton(onClick = {
                    onViewDetails()
                }) {
                    Icon(Icons.Default.Info, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Подробнее")
                }
                TextButton(onClick = {
                    onShare()
                    onDismiss()
                }) {
                    Icon(Icons.Default.Share, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Поделиться")
                }
                TextButton(onClick = {
                    onFavorite()
                    onDismiss()
                }) {
                    Icon(Icons.Default.Favorite, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("В избранное")
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Отмена")
            }
        }
    )
}

